import type { InferRouteInput, RouteInference, Confidence } from "./types";
import { parseCallsign } from "./parseCallsign";
import { findRoutesByAirline, getTopRoute, rankRoutesByProximity } from "./matchRoutes";
import { getAllAirlines } from "./data/routes";
import { getAirport } from "./data/airports";

const KNOWN_AIRLINES = new Set(getAllAirlines());

function inferConfidence(
  hasAirline: boolean,
  hasFlightNumber: boolean,
  hasMultipleRoutes: boolean,
  hasPosition: boolean
): Confidence {
  if (!hasAirline) return "low";
  if (hasFlightNumber && !hasMultipleRoutes) return "high";
  if (hasFlightNumber && hasMultipleRoutes) return "medium";
  if (hasPosition && hasAirline) return "medium";
  return "low";
}

export function inferRoute(input: InferRouteInput): RouteInference {
  const { callsign, lat, lon } = input;

  if (!callsign || callsign.trim().length < 2) {
    return {
      from: null,
      to: null,
      confidence: "low",
      reasoning: "No callsign provided or callsign too short",
    };
  }

  const parsed = parseCallsign(callsign);

  if (!parsed.airlineCode) {
    return {
      from: null,
      to: null,
      confidence: "low",
      reasoning: `Could not parse airline code from callsign "${callsign}"`,
    };
  }

  const airlineKnown = KNOWN_AIRLINES.has(parsed.airlineCode.toUpperCase());
  const hasFlightNumber = parsed.flightNumber.length >= 2;

  let reasoning = `Parsed callsign "${callsign}" → airline: ${parsed.airlineCode}`;

  if (hasFlightNumber) {
    reasoning += `, flight: ${parsed.flightNumber}`;
  } else {
    reasoning += ", flight number not detected";
  }

  if (!airlineKnown) {
    reasoning += ` (airline not in route database)`;
  }

  const routeMatches = findRoutesByAirline(parsed.airlineCode, parsed.flightNumber);

  if (routeMatches.length === 0) {
    return {
      from: null,
      to: null,
      confidence: "low",
      reasoning: `${reasoning} - no routes found for airline ${parsed.airlineCode}`,
    };
  }

  let rankedMatches = routeMatches;
  if (lat !== undefined && lon !== undefined) {
    rankedMatches = rankRoutesByProximity(routeMatches, lat, lon);
  }

  const bestMatch = rankedMatches[0];
  const hasMultiple = rankedMatches.length > 1;

  if (!bestMatch?.from || !bestMatch?.to) {
    return {
      from: null,
      to: null,
      confidence: "low",
      reasoning: `${reasoning} - airport lookup failed`,
    };
  }

  const fromCode = bestMatch.from.iata || bestMatch.from.icao;
  const toCode = bestMatch.to.iata || bestMatch.to.icao;

  const confidence = inferConfidence(
    true,
    hasFlightNumber,
    hasMultiple,
    lat !== undefined && lon !== undefined
  );

  if (hasMultiple) {
    reasoning += `, selected from ${rankedMatches.length} routes`;
  }

  if (bestMatch.distance !== undefined) {
    reasoning += `, closest endpoint ~${Math.round(bestMatch.distance)}km`;
  }

  return {
    from: fromCode,
    to: toCode,
    confidence,
    reasoning,
  };
}

export const inferRouteFromPlane = (plane: {
  callsign: string | null;
  latitude?: number;
  longitude?: number;
}): RouteInference => {
  return inferRoute({
    callsign: plane.callsign,
    lat: plane.latitude,
    lon: plane.longitude,
  });
};