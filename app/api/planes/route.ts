import type { NextRequest } from "next/server";
import {
  FALLBACK_BOUNDS,
  JSON_HEADERS,
  MERGED_LIVE_ROUTE_NOTE,
  centerFromBounds,
  mergePlanes,
  normalizeAdsbExchangeResponse,
  normalizeOpenSkyStates,
  radiusNmFromBounds,
  sanitizeBounds,
  viewportBucketForBounds,
  type BoundsQuery,
  type FlightDataProvider,
  type Plane,
  type PlaneApiResponse,
  type ViewportBucket,
} from "@/lib/aviation";

export const runtime = "nodejs";

const ALL_PROVIDERS: FlightDataProvider[] = ["opensky", "adsblol", "adsbfi"];
const OPENSKY_URL = "https://opensky-network.org/api/states/all";
const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const ADSB_LOL_URL = "https://api.adsb.lol";
const ADSB_FI_URL = "https://opendata.adsb.fi/api";
const RESPONSE_CACHE_TTL_MS = 20_000;
const PROVIDER_CACHE_TTL_MS: Record<FlightDataProvider, number> = {
  opensky: 20_000,
  adsblol: 20_000,
  adsbfi: 20_000,
};
const PROVIDER_BACKOFF_MS: Record<FlightDataProvider, number> = {
  opensky: 60_000,
  adsblol: 8_000,
  adsbfi: 1_000,
};
const PROVIDER_FETCH_TIMEOUT_MS: Record<FlightDataProvider, number> = {
  opensky: 1_800,
  adsblol: 1_400,
  adsbfi: 1_400,
};
const INITIAL_RESPONSE_BUDGET_MS = 900;

type CacheEntry = {
  data: PlaneApiResponse;
  expiresAt: number;
};

type ProviderCacheEntry = {
  planes: Plane[];
  expiresAt: number;
};

type ProviderFetchResult = {
  provider: FlightDataProvider;
  planes: Plane[];
  stale: boolean;
  error: string | null;
};

type OpenSkyTokenState = {
  accessToken: string | null;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry>();
const providerCache = new Map<string, ProviderCacheEntry>();
const inflightProviderRequests = new Map<string, Promise<ProviderFetchResult>>();
const providerCooldownUntil = new Map<FlightDataProvider, number>();
const openSkyTokenState: OpenSkyTokenState = {
  accessToken: null,
  expiresAt: 0,
};

function parseBounds(request: NextRequest): BoundsQuery {
  const northParam = request.nextUrl.searchParams.get("north");
  const southParam = request.nextUrl.searchParams.get("south");
  const eastParam = request.nextUrl.searchParams.get("east");
  const westParam = request.nextUrl.searchParams.get("west");

  if (!northParam || !southParam || !eastParam || !westParam) {
    return FALLBACK_BOUNDS;
  }

  const north = Number(northParam);
  const south = Number(southParam);
  const east = Number(eastParam);
  const west = Number(westParam);

  if ([north, south, east, west].some((value) => Number.isNaN(value))) {
    return FALLBACK_BOUNDS;
  }

  return sanitizeBounds({ north, south, east, west });
}

function getCacheKey(viewport: ViewportBucket) {
  return viewport.key;
}

function getProviderCacheKey(provider: FlightDataProvider, viewport: ViewportBucket) {
  return JSON.stringify({
    provider,
    viewport: viewport.key,
  });
}

function withMeta(
  viewport: ViewportBucket,
  planes: PlaneApiResponse["planes"],
  {
    cached,
    stale,
    error,
    degradedProviders,
  }: {
    cached: boolean;
    stale: boolean;
    error: string | null;
    degradedProviders: FlightDataProvider[];
  }
): PlaneApiResponse {
  return {
    planes,
    meta: {
      bbox: viewport.bounds,
      cached,
      stale,
      fetchedAt: new Date().toISOString(),
      placeholderRouteData: true,
      routeNote: MERGED_LIVE_ROUTE_NOTE,
      providers: ALL_PROVIDERS,
      degradedProviders,
      error,
    },
  };
}

function cachedResponse(
  data: PlaneApiResponse,
  {
    stale,
    error,
    degradedProviders,
  }: {
    stale: boolean;
    error: string | null;
    degradedProviders?: FlightDataProvider[];
  }
) {
  return {
    ...data,
    meta: {
      ...data.meta,
      cached: true,
      stale,
      error,
      degradedProviders: degradedProviders ?? data.meta.degradedProviders,
    },
  } satisfies PlaneApiResponse;
}

function extractRetryAfterMs(response: Response, provider: FlightDataProvider) {
  const retryAfterValue =
    response.headers.get("x-rate-limit-retry-after-seconds") ??
    response.headers.get("retry-after");

  if (!retryAfterValue) {
    return PROVIDER_BACKOFF_MS[provider];
  }

  const seconds = Number(retryAfterValue);

  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryAt = Date.parse(retryAfterValue);

  if (!Number.isNaN(retryAt)) {
    return Math.max(0, retryAt - Date.now());
  }

  return PROVIDER_BACKOFF_MS[provider];
}

async function getOpenSkyAccessToken() {
  if (!process.env.OPENSKY_CLIENT_ID || !process.env.OPENSKY_CLIENT_SECRET) {
    return null;
  }

  if (
    openSkyTokenState.accessToken &&
    openSkyTokenState.expiresAt > Date.now() + 60_000
  ) {
    return openSkyTokenState.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.OPENSKY_CLIENT_ID,
    client_secret: process.env.OPENSKY_CLIENT_SECRET,
  });

  const response = await fetch(OPENSKY_TOKEN_URL, {
    method: "POST",
    body,
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    throw new Error(`OpenSky auth returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new Error("OpenSky auth did not return an access token");
  }

  openSkyTokenState.accessToken = payload.access_token;
  openSkyTokenState.expiresAt =
    Date.now() + Math.max(60, (payload.expires_in ?? 1800) - 60) * 1000;

  return openSkyTokenState.accessToken;
}

async function fetchOpenSkyResponse(bounds: BoundsQuery) {
  const url = new URL(OPENSKY_URL);
  url.searchParams.set("lamin", bounds.south.toString());
  url.searchParams.set("lomin", bounds.west.toString());
  url.searchParams.set("lamax", bounds.north.toString());
  url.searchParams.set("lomax", bounds.east.toString());

  let accessToken = await getOpenSkyAccessToken();
  const timeoutSignal = AbortSignal.timeout(PROVIDER_FETCH_TIMEOUT_MS.opensky);
  let response = await fetch(url, {
    cache: "no-store",
    signal: timeoutSignal,
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined,
  });

  if (response.status === 401 && accessToken) {
    openSkyTokenState.accessToken = null;
    openSkyTokenState.expiresAt = 0;
    accessToken = await getOpenSkyAccessToken();
    response = await fetch(url, {
      cache: "no-store",
      signal: timeoutSignal,
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
    });
  }

  return response;
}

async function fetchProviderResponse(
  provider: FlightDataProvider,
  bounds: BoundsQuery
) {
  if (provider === "opensky") {
    return fetchOpenSkyResponse(bounds);
  }

  const center = centerFromBounds(bounds);
  const radiusNm = radiusNmFromBounds(bounds);
  const url =
    provider === "adsbfi"
      ? `${ADSB_FI_URL}/v3/lat/${center.lat}/lon/${center.lng}/dist/${radiusNm}`
      : `${ADSB_LOL_URL}/v2/lat/${center.lat}/lon/${center.lng}/dist/${radiusNm}`;

  return fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(PROVIDER_FETCH_TIMEOUT_MS[provider]),
  });
}

function normalizeProviderPayload(
  provider: FlightDataProvider,
  payload: unknown
) {
  return provider === "opensky"
    ? normalizeOpenSkyStates(payload)
    : normalizeAdsbExchangeResponse(payload);
}

function describeRateLimitStrategy(provider: FlightDataProvider) {
  switch (provider) {
    case "adsbfi":
      return "One live flight feed is temporarily unavailable";
    case "adsblol":
    case "opensky":
    default:
      return "A live flight feed is temporarily unavailable";
  }
}

function providerTimeoutMessage(provider: FlightDataProvider) {
  switch (provider) {
    case "opensky":
      return "OpenSky is responding slowly right now";
    case "adsblol":
    case "adsbfi":
    default:
      return "A flight feed is responding slowly right now";
  }
}

async function fetchProviderData(
  provider: FlightDataProvider,
  viewport: ViewportBucket
): Promise<ProviderFetchResult> {
  const cacheKey = getProviderCacheKey(provider, viewport);
  const now = Date.now();
  const cachedEntry = providerCache.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > now) {
    return {
      provider,
      planes: cachedEntry.planes,
      stale: false,
      error: null,
    };
  }

  const cooldownUntil = providerCooldownUntil.get(provider) ?? 0;

  if (cooldownUntil > now) {
    const cooldownMessage = `${describeRateLimitStrategy(
      provider
    )}. Showing a recent nearby-flight snapshot when available.`;

    return {
      provider,
      planes: cachedEntry?.planes ?? [],
      stale: true,
      error: cooldownMessage,
    };
  }

  const inflightRequest = inflightProviderRequests.get(cacheKey);

  if (inflightRequest) {
    return inflightRequest;
  }

  const requestPromise = (async () => {
    try {
      const response = await fetchProviderResponse(provider, viewport.bounds);

      if (!response.ok) {
        if (response.status === 429) {
          providerCooldownUntil.set(
            provider,
            Date.now() + extractRetryAfterMs(response, provider)
          );
        }

        throw new Error(
          response.status === 429
            ? describeRateLimitStrategy(provider)
            : "A live flight feed could not be reached"
        );
      }

      const planes = normalizeProviderPayload(provider, await response.json());

      providerCache.set(cacheKey, {
        planes,
        expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS[provider],
      });

      return {
        provider,
        planes,
        stale: false,
        error: null,
      } satisfies ProviderFetchResult;
    } catch (error) {
      const timeoutError =
        error instanceof DOMException && error.name === "TimeoutError";

      return {
        provider,
        planes: cachedEntry?.planes ?? [],
        stale: Boolean(cachedEntry),
        error: timeoutError
          ? `${providerTimeoutMessage(
              provider
            )}. Showing a recent nearby-flight snapshot when available.`
          : error instanceof Error
            ? error.message
            : "A live flight feed could not be reached",
      } satisfies ProviderFetchResult;
    } finally {
      inflightProviderRequests.delete(cacheKey);
    }
  })();

  inflightProviderRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

function summarizeProviderIssues(results: ProviderFetchResult[]) {
  const degradedProviders = results
    .filter((result) => result.error)
    .map((result) => result.provider);

  if (!degradedProviders.length) {
    return {
      degradedProviders,
      error: null,
    };
  }

  return {
    degradedProviders,
    error:
      degradedProviders.length === ALL_PROVIDERS.length
        ? "Live updates are temporarily unavailable, so the app is using the last recent nearby-aircraft snapshot if one exists."
        : "Some live updates are temporarily unavailable, so the map may look a little quieter than usual.",
  };
}

function sortPlanesByFreshness(planes: Plane[]) {
  return [...planes].sort(
    (left, right) => (right.lastContact ?? 0) - (left.lastContact ?? 0)
  );
}

export async function GET(request: NextRequest) {
  const bounds = parseBounds(request);
  const viewport = viewportBucketForBounds(bounds);
  const cacheKey = getCacheKey(viewport);
  const now = Date.now();
  const cachedEntry = responseCache.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > now) {
    return Response.json(
      cachedResponse(cachedEntry.data, {
        stale: false,
        error: null,
      }),
      {
        headers: JSON_HEADERS,
      }
    );
  }

  const providerPromises = ALL_PROVIDERS.map((provider) =>
    fetchProviderData(provider, viewport)
  );
  const readyResults: ProviderFetchResult[] = [];
  const pendingProviders = new Set<FlightDataProvider>(ALL_PROVIDERS);

  for (const providerPromise of providerPromises) {
    void providerPromise.then((result) => {
      readyResults.push(result);
      pendingProviders.delete(result.provider);
    });
  }

  await Promise.race([
    Promise.all(providerPromises),
    new Promise((resolve) => setTimeout(resolve, INITIAL_RESPONSE_BUDGET_MS)),
  ]);

  const shouldRespondEarly =
    pendingProviders.size > 0 && readyResults.some((result) => result.planes.length > 0);

  const providerResults = shouldRespondEarly
    ? [
        ...readyResults,
        ...[...pendingProviders].map((provider) => ({
          provider,
          planes: [],
          stale: true,
          error: `${providerTimeoutMessage(
            provider
          )}. Waiting for additional providers in the background.`,
        })),
      ]
    : await Promise.all(providerPromises);
  const mergedPlanes = sortPlanesByFreshness(
    mergePlanes(providerResults.flatMap((result) => result.planes))
  );
  const { degradedProviders, error } = summarizeProviderIssues(providerResults);
  const responseIsStale =
    degradedProviders.length > 0 &&
    degradedProviders.every((provider) =>
      providerResults.some(
        (result) => result.provider === provider && result.stale
      )
    );

  if (!mergedPlanes.length && cachedEntry) {
    return Response.json(
      cachedResponse(cachedEntry.data, {
        stale: true,
        error,
        degradedProviders,
      }),
      {
        headers: JSON_HEADERS,
      }
    );
  }

  if (!mergedPlanes.length) {
    return Response.json(
      {
        message:
          "Unable to load nearby flights right now. Try again in a moment.",
      },
      {
        status: 502,
        headers: JSON_HEADERS,
      }
    );
  }

  const result = withMeta(viewport, mergedPlanes, {
    cached: false,
    stale: responseIsStale,
    error,
    degradedProviders,
  });

  responseCache.set(cacheKey, {
    data: result,
    expiresAt: now + RESPONSE_CACHE_TTL_MS,
  });

  return Response.json(result, {
    headers: {
      ...JSON_HEADERS,
      "Cache-Control": "public, s-maxage=20, stale-while-revalidate=20",
    },
  });
}
