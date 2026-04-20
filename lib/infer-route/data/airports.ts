import type { Airport } from "../types";
import rawAirports from "./airports.json";

const airportsArray: Airport[] = rawAirports as Airport[];

export const airportsData = airportsArray;

export function getAirportByIata(iata: string): Airport | null {
  const search = iata.toUpperCase();
  return airportsData.find((a) => a.iata === search) || null;
}

export function getAirportByIcao(icao: string): Airport | null {
  const search = icao.toUpperCase();
  return airportsData.find((a) => a.icao === search) || null;
}

export function getAirport(iataOrIcao: string): Airport | null {
  return getAirportByIata(iataOrIcao) || getAirportByIcao(iataOrIcao);
}