import { haversineKm } from "@/lib/aviation";

export type GeoPoint = {
  lat: number;
  lon: number;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function isFiniteCoordinate(value: number) {
  return Number.isFinite(value);
}

export function hasValidGeoPoint(point: GeoPoint) {
  return isFiniteCoordinate(point.lat) && isFiniteCoordinate(point.lon);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toEquirectangularKm(point: GeoPoint, referenceLat: number) {
  const latRad = toRadians(point.lat);
  const lonRad = toRadians(point.lon);
  const refLatRad = toRadians(referenceLat);

  return {
    x: EARTH_RADIUS_KM * lonRad * Math.cos(refLatRad),
    y: EARTH_RADIUS_KM * latRad,
  };
}

export function distanceKm(from: GeoPoint, to: GeoPoint) {
  if (!hasValidGeoPoint(from) || !hasValidGeoPoint(to)) {
    return 0;
  }

  return haversineKm(from.lat, from.lon, to.lat, to.lon);
}

export function estimateRouteProgressFraction(
  origin: GeoPoint,
  destination: GeoPoint,
  currentPosition: GeoPoint
) {
  if (
    !hasValidGeoPoint(origin) ||
    !hasValidGeoPoint(destination) ||
    !hasValidGeoPoint(currentPosition)
  ) {
    return 0;
  }

  const referenceLat = (origin.lat + destination.lat + currentPosition.lat) / 3;
  const originProjected = toEquirectangularKm(origin, referenceLat);
  const destinationProjected = toEquirectangularKm(destination, referenceLat);
  const currentProjected = toEquirectangularKm(currentPosition, referenceLat);

  const dx = destinationProjected.x - originProjected.x;
  const dy = destinationProjected.y - originProjected.y;
  const routeMagnitudeSquared = dx * dx + dy * dy;

  if (routeMagnitudeSquared <= Number.EPSILON) {
    return 0;
  }

  const travelledDx = currentProjected.x - originProjected.x;
  const travelledDy = currentProjected.y - originProjected.y;
  const projectionRatio =
    (travelledDx * dx + travelledDy * dy) / routeMagnitudeSquared;

  return clamp(projectionRatio, 0, 1);
}
