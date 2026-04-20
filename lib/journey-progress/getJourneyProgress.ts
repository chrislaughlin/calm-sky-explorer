import {
  clamp,
  distanceKm,
  estimateRouteProgressFraction,
  hasValidGeoPoint,
  type GeoPoint,
} from "./geo";
import { formatJourneyProgress } from "./formatJourneyProgress";
import { toFunUnits } from "./funUnits";
import { estimateWalkingHours, formatWalkingHours } from "./walkingTime";
import type { JourneyProgressInput, JourneyProgressResult } from "./types";

function roundToTenth(value: number) {
  return Number(value.toFixed(1));
}

function emptyResult(): JourneyProgressResult {
  const walkingUnavailable = "Walking estimate unavailable";

  return {
    progressPercent: 0,
    distanceKm: {
      total: 0,
      travelled: 0,
      remaining: 0,
    },
    funUnits: {
      travelled: toFunUnits(0),
      remaining: toFunUnits(0),
    },
    walking: {
      estimatedTotalHours: null,
      estimatedRemainingHours: null,
      summaryTotal: walkingUnavailable,
      summaryRemaining: walkingUnavailable,
    },
    summary: {
      progress: "✈️ 0% complete",
      travelled: "🌭 0 hot dogs travelled",
      remaining: "🐕 0 sausage dogs remaining",
      walking: "🚶 Walking estimate unavailable",
    },
  };
}

function hasValidInput(input: JourneyProgressInput) {
  const origin: GeoPoint = input.origin;
  const destination: GeoPoint = input.destination;

  return (
    hasValidGeoPoint(origin) &&
    hasValidGeoPoint(destination) &&
    hasValidGeoPoint(input.currentPosition)
  );
}

export function getJourneyProgress(
  input: JourneyProgressInput
): JourneyProgressResult {
  if (!hasValidInput(input)) {
    return emptyResult();
  }

  const origin: GeoPoint = input.origin;
  const destination: GeoPoint = input.destination;
  const currentPosition: GeoPoint = input.currentPosition;

  const totalKm = distanceKm(origin, destination);
  const projectedProgress = estimateRouteProgressFraction(
    origin,
    destination,
    currentPosition
  );

  const travelledKm = totalKm * projectedProgress;
  const remainingKm = totalKm - travelledKm;
  const progressPercent =
    totalKm <= Number.EPSILON
      ? 0
      : Math.round(clamp((travelledKm / totalKm) * 100, 0, 100));

  const estimatedTotalHours = estimateWalkingHours(totalKm);
  const estimatedRemainingHours = estimateWalkingHours(remainingKm);

  const walking = {
    estimatedTotalHours,
    estimatedRemainingHours,
    summaryTotal: formatWalkingHours(estimatedTotalHours),
    summaryRemaining: formatWalkingHours(estimatedRemainingHours),
  };

  const resultBase = {
    progressPercent,
    distanceKm: {
      total: roundToTenth(totalKm),
      travelled: roundToTenth(travelledKm),
      remaining: roundToTenth(Math.max(0, remainingKm)),
    },
    funUnits: {
      travelled: toFunUnits(travelledKm),
      remaining: toFunUnits(remainingKm),
    },
    walking,
  };

  return {
    ...resultBase,
    summary: formatJourneyProgress(resultBase),
  };
}
