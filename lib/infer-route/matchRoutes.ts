import type { Route, Airport } from "./types";
import { airportsData, getAirport } from "./data/airports";
import { routesData, getRoutesByAirline } from "./data/routes";

export interface RouteMatch {
  route: Route;
  from: Airport | null;
  to: Airport | null;
  distance?: number;
}

export function findRoutesByAirline(
  airline: string,
  _flightNumber?: string
): RouteMatch[] {
  const normalizedAirline = airline.toUpperCase().trim();
  if (!normalizedAirline) return [];

  const routes = getRoutesByAirline(normalizedAirline);

  if (routes.length === 0) return [];

  return routes.map((route) => ({
    route,
    from: getAirport(route.sourceAirport),
    to: getAirport(route.destAirport),
  }));
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function rankRoutesByProximity(
  routeMatches: RouteMatch[],
  currentLat?: number,
  currentLon?: number
): RouteMatch[] {
  if (currentLat === undefined || currentLon === undefined) {
    return routeMatches;
  }

  return routeMatches
    .map((match) => {
      let minDistance = Infinity;

      if (match.from) {
        const distFrom = haversineDistance(
          currentLat,
          currentLon,
          match.from.lat,
          match.from.lon
        );
        minDistance = Math.min(minDistance, distFrom);
      }

      if (match.to) {
        const distTo = haversineDistance(
          currentLat,
          currentLon,
          match.to.lat,
          match.to.lon
        );
        minDistance = Math.min(minDistance, distTo);
      }

      return { ...match, distance: minDistance };
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
}

export function getTopRoute(
  airline: string,
  flightNumber?: string,
  currentLat?: number,
  currentLon?: number
): RouteMatch | null {
  let matches = findRoutesByAirline(airline, flightNumber);

  if (matches.length === 0) return null;

  if (flightNumber) {
    const normalizedFlight = flightNumber.replace(/^0+/, "").toLowerCase();
    const isNumericFlight = /^\d+$/.test(normalizedFlight);

    if (isNumericFlight) {
      matches = matches.slice(0, 10);
    }
  }

  if (currentLat !== undefined && currentLon !== undefined) {
    matches = rankRoutesByProximity(matches, currentLat, currentLon);
  }

  return matches[0] || null;
}