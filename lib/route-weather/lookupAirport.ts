import { airportsData } from "../infer-route/data/airports";
import type { AirportMetadata } from "./types";

const airportByIata = new Map<string, AirportMetadata>();
const airportByIcao = new Map<string, AirportMetadata>();
const airportByCode = new Map<string, AirportMetadata>();

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function buildAirportIndexes() {
  if (airportByCode.size > 0) {
    return;
  }

  for (const airport of airportsData) {
    airportByCode.set(airport.icao.toUpperCase(), airport);
    airportByIcao.set(airport.icao.toUpperCase(), airport);

    if (airport.iata) {
      airportByIata.set(airport.iata.toUpperCase(), airport);
      if (!airportByCode.has(airport.iata.toUpperCase())) {
        airportByCode.set(airport.iata.toUpperCase(), airport);
      }
    }
  }
}

export function lookupAirport(
  airportCode: string | null | undefined
): AirportMetadata | null {
  if (typeof airportCode !== "string") {
    return null;
  }

  const normalized = normalizeCode(airportCode);

  if (!normalized) {
    return null;
  }

  buildAirportIndexes();

  if (normalized.length === 3) {
    return airportByIata.get(normalized) ?? airportByIcao.get(normalized) ?? null;
  }

  if (normalized.length === 4) {
    return airportByIcao.get(normalized) ?? airportByIata.get(normalized) ?? null;
  }

  return airportByCode.get(normalized) ?? null;
}

