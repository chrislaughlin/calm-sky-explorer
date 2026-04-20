import { getJourneyProgress } from "./getJourneyProgress";

const sample = getJourneyProgress({
  origin: { code: "JFK", lat: 40.6413, lon: -73.7781 },
  destination: { code: "LAX", lat: 33.9416, lon: -118.4085 },
  currentPosition: { lat: 39.5, lon: -98.35 },
});

console.log(sample.summary.progress);
console.log(sample.summary.travelled);
console.log(sample.summary.remaining);
console.log(sample.summary.walking);
