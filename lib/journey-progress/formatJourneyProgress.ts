import type { JourneyProgressResult } from "./types";

function formatWholeNumber(value: number) {
  return Math.round(value).toLocaleString();
}

export function formatJourneyProgress(
  progress: Pick<JourneyProgressResult, "progressPercent" | "funUnits" | "walking">
) {
  const hotDogsTravelled = formatWholeNumber(progress.funUnits.travelled.hotDogs);
  const sausageDogsRemaining = formatWholeNumber(
    progress.funUnits.remaining.sausageDogs
  );

  const walkingRemainingLabel =
    progress.walking.estimatedRemainingHours == null
      ? "🚶 Walking estimate unavailable"
      : `🚶 ${progress.walking.summaryRemaining} left on foot`;

  return {
    progress: `✈️ ${progress.progressPercent}% complete`,
    travelled: `🌭 ${hotDogsTravelled} hot dogs travelled`,
    remaining: `🐕 ${sausageDogsRemaining} sausage dogs remaining`,
    walking: walkingRemainingLabel,
  };
}
