const DEFAULT_WALKING_SPEED_KMH = 5;

function roundHours(hours: number) {
  return Number(hours.toFixed(1));
}

export function estimateWalkingHours(
  distanceKm: number,
  walkingSpeedKmh = DEFAULT_WALKING_SPEED_KMH
): number | null {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(walkingSpeedKmh)) {
    return null;
  }

  if (walkingSpeedKmh <= 0) {
    return null;
  }

  return roundHours(Math.max(0, distanceKm) / walkingSpeedKmh);
}

export function formatWalkingHours(hours: number | null) {
  if (hours == null) {
    return "Walking estimate unavailable";
  }

  if (hours < 24) {
    return `${hours.toFixed(1)} hours`;
  }

  const wholeHours = Math.round(hours);
  const days = Math.floor(wholeHours / 24);
  const remainingHours = wholeHours % 24;

  if (remainingHours === 0) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  return `${days} day${days === 1 ? "" : "s"} ${remainingHours} hour${remainingHours === 1 ? "" : "s"}`;
}
