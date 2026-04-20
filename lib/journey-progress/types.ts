export type JourneyPoint = {
  code: string;
  lat: number;
  lon: number;
};

export type JourneyProgressInput = {
  origin: JourneyPoint;
  destination: JourneyPoint;
  currentPosition: { lat: number; lon: number };
};

export type JourneyProgressResult = {
  progressPercent: number;
  distanceKm: {
    total: number;
    travelled: number;
    remaining: number;
  };
  funUnits: {
    travelled: {
      footballFields: number;
      hotDogs: number;
      sausageDogs: number;
    };
    remaining: {
      footballFields: number;
      hotDogs: number;
      sausageDogs: number;
    };
  };
  walking: {
    estimatedTotalHours: number | null;
    estimatedRemainingHours: number | null;
    summaryTotal: string;
    summaryRemaining: string;
  };
  summary: {
    progress: string;
    travelled: string;
    remaining: string;
    walking: string;
  };
};
