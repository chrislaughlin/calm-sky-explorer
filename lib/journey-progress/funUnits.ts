export const METERS_PER_FOOTBALL_FIELD = 105;
export const METERS_PER_HOT_DOG = 0.15;
export const METERS_PER_SAUSAGE_DOG = 0.6;

export type FunUnitTotals = {
  footballFields: number;
  hotDogs: number;
  sausageDogs: number;
};

function kmToMeters(distanceKm: number) {
  return Math.max(0, distanceKm) * 1000;
}

export function toFunUnits(distanceKm: number): FunUnitTotals {
  const meters = kmToMeters(distanceKm);

  return {
    footballFields: Math.round(meters / METERS_PER_FOOTBALL_FIELD),
    hotDogs: Math.round(meters / METERS_PER_HOT_DOG),
    sausageDogs: Math.round(meters / METERS_PER_SAUSAGE_DOG),
  };
}
