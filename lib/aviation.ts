import type { LatLngBounds } from "leaflet";
import { inferRoute } from "./infer-route/inferRoute";
import { getAirport } from "./infer-route/data/airports";

export const OPENSKY_ROUTE_NOTE =
  "OpenSky gives live state vectors, not full commercial routes. This MVP keeps route placeholders ready for a later enrichment source.";
export const ADSB_LOL_ROUTE_NOTE =
  "ADSB.lol uses an ADSBexchange-compatible live aircraft response. It improves nearby coverage, but route enrichment still needs a separate airport data source.";
export const ADSB_FI_ROUTE_NOTE =
  "adsb.fi open data also uses an ADSBexchange-compatible nearby-aircraft response. It is useful for testing coverage, but route enrichment still plugs in later.";
export const MERGED_LIVE_ROUTE_NOTE =
  "Live aircraft positions are working now. Origin and destination details will plug into this card later.";

export const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
} as const;

export type FlightDataProvider = "opensky" | "adsblol" | "adsbfi";

export type FlightRoute = {
  icao24: string;
  callsign: string;
  departureAirport: string | null;
  arrivalAirport: string | null;
  departureTime: number | null;
  arrivalTime: number | null;
  lastSeen: number;
} | null;

export type BoundsQuery = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type ViewportBucketTier = "wide" | "mid" | "near" | "close";

export type ViewportBucket = {
  bounds: BoundsQuery;
  key: string;
  tier: ViewportBucketTier;
};

export type Plane = {
  id: string;
  icao24: string;
  callsign: string | null;
  displayCallsign: string;
  airlineCode: string | null;
  airlineName: string | null;
  originCountry: string;
  latitude: number;
  longitude: number;
  altitudeFt: number | null;
  speedKts: number | null;
  heading: number | null;
  onGround: boolean;
  lastContact: number | null;
  origin: string | null;
  destination: string | null;
};

export type PlaneApiResponse = {
  planes: Plane[];
  meta: {
    bbox: BoundsQuery;
    cached: boolean;
    stale: boolean;
    fetchedAt: string;
    placeholderRouteData: boolean;
    routeNote: string;
    providers: FlightDataProvider[];
    degradedProviders: FlightDataProvider[];
    error: string | null;
  };
};

type OpenSkyResponse = {
  states?: OpenSkyStateVector[];
};

type AdsbExchangeCompatibleResponse = {
  ac?: AdsbExchangeCompatibleAircraft[];
  now?: number;
};

type AdsbExchangeCompatibleAircraft = {
  alt_baro?: number | string | null;
  flight?: string | null;
  gs?: number | null;
  hex: string;
  lat?: number | null;
  lon?: number | null;
  r?: string | null;
  seen?: number | null;
  seen_pos?: number | null;
  t?: string | null;
  track?: number | null;
 };

type OpenSkyStateVector = [
  icao24: string,
  callsign: string | null,
  originCountry: string,
  timePosition: number | null,
  lastContact: number | null,
  longitude: number | null,
  latitude: number | null,
  baroAltitude: number | null,
  onGround: boolean,
  velocity: number | null,
  trueTrack: number | null,
  verticalRate: number | null,
  sensors: unknown,
  geoAltitude: number | null,
  squawk: string | null,
  spi: boolean,
  positionSource: number | null,
  category?: number | null,
];

const FEET_PER_METER = 3.28084;
const KNOTS_PER_MS = 1.94384;
const MIN_HALF_SPAN_LAT = 0.28;
const MIN_HALF_SPAN_LON = 0.35;
const MAX_HALF_SPAN_LAT = 1.8;
const MAX_HALF_SPAN_LON = 2.15;

const AIRLINE_PREFIXES: Record<string, string> = {
  AAL: "American Airlines",
  AFR: "Air France",
  ASA: "Alaska Airlines",
  BAW: "British Airways",
  DAL: "Delta Air Lines",
  EIN: "Aer Lingus",
  EZY: "easyJet",
  JBU: "JetBlue",
  KLM: "KLM",
  NKS: "Spirit Airlines",
  QTR: "Qatar Airways",
  RYR: "Ryanair",
  SAS: "Scandinavian Airlines",
  SWA: "Southwest Airlines",
  THY: "Turkish Airlines",
  UAE: "Emirates",
  UAL: "United Airlines",
  VIR: "Virgin Atlantic",
};

export const FALLBACK_CENTER = {
  lat: 40.7128,
  lng: -74.006,
};

export const FALLBACK_BOUNDS = boundsAroundPoint(
  FALLBACK_CENTER.lat,
  FALLBACK_CENTER.lng,
  1.1,
  1.45
);

export const FLIGHT_DATA_SOURCE_OPTIONS: Array<{
  id: FlightDataProvider;
  label: string;
  shortLabel: string;
}> = [
  {
    id: "opensky",
    label: "OpenSky",
    shortLabel: "OpenSky",
  },
  {
    id: "adsblol",
    label: "ADSB.lol",
    shortLabel: "ADSB.lol",
  },
  {
    id: "adsbfi",
    label: "adsb.fi",
    shortLabel: "adsb.fi",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function roundUpToStep(value: number, step: number) {
  return Math.ceil(value / step) * step;
}

function roundDownToStep(value: number, step: number) {
  return Math.floor(value / step) * step;
}

function normalizeProviderNow(value: number | undefined) {
  if (value == null) {
    return Math.floor(Date.now() / 1000);
  }

  return value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
}

function deriveAirline(callsign: string | null) {
  if (!callsign) {
    return {
      airlineCode: null,
      airlineName: null,
    };
  }

  const prefix = callsign.slice(0, 3).toUpperCase();

  return {
    airlineCode: /^[A-Z]{3}$/.test(prefix) ? prefix : null,
    airlineName: AIRLINE_PREFIXES[prefix] ?? null,
  };
}

function displayCallsign(callsign: string | null, icao24: string) {
  return callsign ?? icao24.toUpperCase();
}

export function providerLabel(provider: FlightDataProvider) {
  return (
    FLIGHT_DATA_SOURCE_OPTIONS.find((option) => option.id === provider)?.label ??
    provider
  );
}

export function routeNoteForProvider(provider: FlightDataProvider) {
  switch (provider) {
    case "adsblol":
      return ADSB_LOL_ROUTE_NOTE;
    case "adsbfi":
      return ADSB_FI_ROUTE_NOTE;
    case "opensky":
    default:
      return OPENSKY_ROUTE_NOTE;
  }
}

function planeDataScore(plane: Plane) {
  let score = 0;

  if (plane.callsign) {
    score += 2;
  }

  if (plane.airlineName || plane.airlineCode) {
    score += 2;
  }

  if (plane.altitudeFt != null) {
    score += 1;
  }

  if (plane.speedKts != null) {
    score += 1;
  }

  if (plane.heading != null) {
    score += 1;
  }

  if (!plane.onGround) {
    score += 1;
  }

  return score;
}

function pickPreferredPlane(left: Plane, right: Plane) {
  const leftLastContact = left.lastContact ?? 0;
  const rightLastContact = right.lastContact ?? 0;

  if (leftLastContact !== rightLastContact) {
    return leftLastContact > rightLastContact ? left : right;
  }

  return planeDataScore(left) >= planeDataScore(right) ? left : right;
}

export function sanitizeBounds(bounds: BoundsQuery): BoundsQuery {
  const centerLat = clamp((bounds.north + bounds.south) / 2, -89.5, 89.5);
  const centerLng = clamp((bounds.east + bounds.west) / 2, -179.5, 179.5);
  const halfLat = clamp(
    Math.abs(bounds.north - bounds.south) / 2,
    MIN_HALF_SPAN_LAT,
    MAX_HALF_SPAN_LAT
  );
  const halfLng = clamp(
    Math.abs(bounds.east - bounds.west) / 2,
    MIN_HALF_SPAN_LON,
    MAX_HALF_SPAN_LON
  );

  return {
    north: round(clamp(centerLat + halfLat, -89.5, 89.5)),
    south: round(clamp(centerLat - halfLat, -89.5, 89.5)),
    east: round(clamp(centerLng + halfLng, -179.5, 179.5)),
    west: round(clamp(centerLng - halfLng, -179.5, 179.5)),
  };
}

export function serializeBounds(bounds: BoundsQuery) {
  return {
    north: round(bounds.north, 2),
    south: round(bounds.south, 2),
    east: round(bounds.east, 2),
    west: round(bounds.west, 2),
  };
}

export function boundsAroundPoint(
  latitude: number,
  longitude: number,
  halfLat: number,
  halfLng: number
) {
  return sanitizeBounds({
    north: latitude + halfLat,
    south: latitude - halfLat,
    east: longitude + halfLng,
    west: longitude - halfLng,
  });
}

export function boundsFromLeafletBounds(bounds: LatLngBounds) {
  return sanitizeBounds({
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  });
}

function viewportBucketTierForBounds(bounds: BoundsQuery): {
  tier: ViewportBucketTier;
  step: number;
} {
  const halfLat = Math.abs(bounds.north - bounds.south) / 2;
  const halfLng = Math.abs(bounds.east - bounds.west) / 2;
  const maxHalfSpan = Math.max(halfLat, halfLng);

  if (maxHalfSpan >= 1.6) {
    return {
      tier: "wide",
      step: 1,
    };
  }

  if (maxHalfSpan >= 0.9) {
    return {
      tier: "mid",
      step: 0.5,
    };
  }

  if (maxHalfSpan >= 0.45) {
    return {
      tier: "near",
      step: 0.25,
    };
  }

  return {
    tier: "close",
    step: 0.1,
  };
}

export function viewportBucketForBounds(bounds: BoundsQuery): ViewportBucket {
  const tier = viewportBucketTierForBounds(bounds);
  const bucketBounds = sanitizeBounds({
    north: round(roundUpToStep(bounds.north, tier.step), 4),
    south: round(roundDownToStep(bounds.south, tier.step), 4),
    east: round(roundUpToStep(bounds.east, tier.step), 4),
    west: round(roundDownToStep(bounds.west, tier.step), 4),
  });

  return {
    tier: tier.tier,
    bounds: bucketBounds,
    key: JSON.stringify({
      tier: tier.tier,
      bounds: serializeBounds(bucketBounds),
    }),
  };
}

export function centerFromBounds(bounds: BoundsQuery) {
  return {
    lat: round((bounds.north + bounds.south) / 2, 5),
    lng: round((bounds.east + bounds.west) / 2, 5),
  };
}

export function radiusNmFromBounds(bounds: BoundsQuery) {
  const center = centerFromBounds(bounds);
  const cornerDistanceKm = haversineKm(
    center.lat,
    center.lng,
    bounds.north,
    bounds.east
  );

  return clamp(Math.ceil(cornerDistanceKm / 1.852), 5, 250);
}

export function normalizeOpenSkyStates(payload: unknown): Plane[] {
  const openSkyPayload = payload as OpenSkyResponse;
  const states = Array.isArray(openSkyPayload.states) ? openSkyPayload.states : [];

  return states
    .map((state) => {
      const latitude = state[6];
      const longitude = state[5];

      if (latitude == null || longitude == null) {
        return null;
      }

      const trimmedCallsign = state[1]?.trim() || null;
      const altitudeMeters = state[13] ?? state[7];
      const speedMs = state[9];
      const { airlineCode, airlineName } = deriveAirline(trimmedCallsign);
      const route = inferRoute({
        callsign: trimmedCallsign,
        lat: latitude,
        lon: longitude,
      });

      return {
        id: state[0].toLowerCase(),
        icao24: state[0].toLowerCase(),
        callsign: trimmedCallsign,
        displayCallsign: displayCallsign(trimmedCallsign, state[0]),
        airlineCode,
        airlineName,
        originCountry: state[2],
        latitude,
        longitude,
        altitudeFt:
          altitudeMeters == null
            ? null
            : Math.max(0, Math.round(altitudeMeters * FEET_PER_METER)),
        speedKts:
          speedMs == null ? null : Math.max(0, Math.round(speedMs * KNOTS_PER_MS)),
        heading: state[10] == null ? null : Math.round(state[10]),
        onGround: Boolean(state[8]),
        lastContact: state[4],
        origin: route.from,
        destination: route.to,
      } satisfies Plane;
    })
    .filter((plane): plane is Plane => Boolean(plane));
}

export function normalizeAdsbExchangeResponse(payload: unknown): Plane[] {
  const adsbPayload = payload as AdsbExchangeCompatibleResponse;
  const aircraft = Array.isArray(adsbPayload.ac) ? adsbPayload.ac : [];
  const now = normalizeProviderNow(adsbPayload.now);

  return aircraft
    .map((plane) => {
      if (plane.lat == null || plane.lon == null) {
        return null;
      }

      const callsign = plane.flight?.trim() || null;
      const { airlineCode, airlineName } = deriveAirline(callsign);
      const onGround = plane.alt_baro === "ground";
      const altitudeFt =
        plane.alt_baro == null || plane.alt_baro === "ground"
          ? onGround
            ? 0
            : null
          : Math.max(0, Math.round(Number(plane.alt_baro)));
      const seen = plane.seen ?? plane.seen_pos ?? null;
      const route = inferRoute({
        callsign,
        lat: plane.lat,
        lon: plane.lon,
      });

      return {
        id: plane.hex.toLowerCase(),
        icao24: plane.hex.toLowerCase(),
        callsign,
        displayCallsign: displayCallsign(callsign, plane.hex),
        airlineCode,
        airlineName,
        originCountry: "Unknown",
        latitude: plane.lat,
        longitude: plane.lon,
        altitudeFt,
        speedKts:
          plane.gs == null ? null : Math.max(0, Math.round(Number(plane.gs))),
        heading:
          plane.track == null ? null : Math.round(Number(plane.track)),
        onGround,
        lastContact:
          seen == null ? null : Math.max(0, Math.round(now - Number(seen))),
        origin: route.from,
        destination: route.to,
      } satisfies Plane;
    })
    .filter((plane): plane is Plane => Boolean(plane));
}

export function mergePlanes(planes: Plane[]) {
  const mergedPlanes = new Map<string, Plane>();

  for (const plane of planes) {
    const key = plane.icao24.toLowerCase();
    const existingPlane = mergedPlanes.get(key);

    if (!existingPlane) {
      mergedPlanes.set(key, {
        ...plane,
        id: key,
        icao24: key,
      });
      continue;
    }

    const primary = pickPreferredPlane(existingPlane, plane);
    const secondary = primary === existingPlane ? plane : existingPlane;
    const callsign = primary.callsign ?? secondary.callsign;

    mergedPlanes.set(key, {
      id: key,
      icao24: key,
      callsign,
      displayCallsign: displayCallsign(callsign, key),
      airlineCode: primary.airlineCode ?? secondary.airlineCode,
      airlineName: primary.airlineName ?? secondary.airlineName,
      originCountry:
        primary.originCountry !== "Unknown"
          ? primary.originCountry
          : secondary.originCountry,
      latitude: primary.latitude,
      longitude: primary.longitude,
      altitudeFt: primary.altitudeFt ?? secondary.altitudeFt,
      speedKts: primary.speedKts ?? secondary.speedKts,
      heading: primary.heading ?? secondary.heading,
      onGround: primary.onGround,
      lastContact: primary.lastContact ?? secondary.lastContact,
      origin: primary.origin ?? secondary.origin,
      destination: primary.destination ?? secondary.destination,
    });
  }

  return [...mergedPlanes.values()];
}

export function isLikelyAirbornePlane(plane: Plane) {
  if (plane.onGround) {
    return false;
  }

  if (
    plane.altitudeFt != null &&
    plane.altitudeFt < 500 &&
    plane.speedKts != null &&
    plane.speedKts < 60
  ) {
    return false;
  }

  return true;
}

export function haversineKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);

  const start =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2;
  const arc = 2 * Math.atan2(Math.sqrt(start), Math.sqrt(1 - start));

  return earthRadiusKm * arc;
}

export function formatDistanceKm(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(1)} km`;
}

export function formatRelativeTime(value: string | number) {
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  const deltaMs = Date.now() - date.getTime();
  const deltaSeconds = Math.max(1, Math.round(deltaMs / 1000));

  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }

  const deltaMinutes = Math.round(deltaSeconds / 60);

  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  return `${deltaHours}h ago`;
}

import { airlineCodeToName } from "./airline-codes";

export function formatAirlineLabel(plane: Plane) {
  if (plane.airlineName) {
    return plane.callsign
      ? `${plane.airlineName} • ${plane.callsign}`
      : plane.airlineName;
  }

  if (plane.airlineCode) {
    const knownName = airlineCodeToName[plane.airlineCode];
    if (knownName) {
      return plane.callsign
        ? `${knownName} • ${plane.callsign}`
        : knownName;
    }
    return `Airline code ${plane.airlineCode}`;
  }

  return "Airline not identified yet";
}

export async function fetchFlightRoute(callsign: string): Promise<FlightRoute> {
  if (!callsign || callsign.length < 3) {
    return null;
  }

  try {
    const url = new URL("/api/flights", window.location.origin);
    url.searchParams.set("callsign", callsign);

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

export function getAirportName(code: string | null): string | null {
  if (!code) return null;
  const airport = getAirport(code);
  return airport?.name ?? null;
}
