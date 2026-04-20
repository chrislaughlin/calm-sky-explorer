import type { NextRequest } from "next/server";
import {
  JSON_HEADERS,
  type FlightRoute,
} from "@/lib/aviation";

export const runtime = "nodejs";

const OPENSKY_FLIGHTS_URL = "https://opensky-network.org/api/flights/callsign";
const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

type OpenSkyTokenState = {
  accessToken: string | null;
  expiresAt: number;
};

const openSkyTokenState: OpenSkyTokenState = {
  accessToken: null,
  expiresAt: 0,
};

type OpenSkyFlight = {
  icao24: string;
  callsign: string;
  estDepartureAirport: string | null;
  estArrivalAirport: string | null;
  firstSeen: number;
  lastSeen: number;
  departureTime: number | null;
  arrivalTime: number | null;
};

const routeCache = new Map<string, { route: FlightRoute; expiresAt: number }>();
const ROUTE_CACHE_TTL_MS = 60_000;

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
    return null;
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    return null;
  }

  openSkyTokenState.accessToken = payload.access_token;
  openSkyTokenState.expiresAt =
    Date.now() + Math.max(60, (payload.expires_in ?? 1800) - 60) * 1000;

  return openSkyTokenState.accessToken;
}

function parseCallsigh(request: NextRequest): string | null {
  const callsign = request.nextUrl.searchParams.get("callsign");
  return callsign?.trim() || null;
}

async function fetchFlightRouteFromOpenSky(
  callsign: string
): Promise<FlightRoute> {
  const url = new URL(OPENSKY_FLIGHTS_URL);
  url.searchParams.set("callsign", callsign);

  const accessToken = await getOpenSkyAccessToken();

  const response = await fetch(url, {
    cache: "no-store",
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined,
  });

  if (!response.ok) {
    return null;
  }

  const flights = (await response.json()) as OpenSkyFlight[];

  if (!flights || flights.length === 0) {
    return null;
  }

  const mostRecent = flights.reduce((latest, flight) =>
    flight.lastSeen > latest.lastSeen ? flight : latest
  );

  return {
    icao24: mostRecent.icao24,
    callsign: mostRecent.callsign,
    departureAirport: mostRecent.estDepartureAirport,
    arrivalAirport: mostRecent.estArrivalAirport,
    departureTime: mostRecent.departureTime,
    arrivalTime: mostRecent.arrivalTime,
    lastSeen: mostRecent.lastSeen,
  };
}

export async function GET(request: NextRequest) {
  const callsign = parseCallsigh(request);

  if (!callsign) {
    return Response.json(
      { error: "Missing callsign parameter" },
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const cacheKey = callsign.toUpperCase();
  const cached = routeCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return Response.json(cached.route, { headers: JSON_HEADERS });
  }

  const route = await fetchFlightRouteFromOpenSky(callsign);

  routeCache.set(cacheKey, {
    route,
    expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
  });

  return Response.json(route, { headers: JSON_HEADERS });
}
