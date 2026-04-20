export interface Airport {
  iata: string | null;
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export interface Route {
  airline: string;
  sourceAirport: string;
  sourceAirportId: number;
  destAirport: string;
  destAirportId: number;
  stops: number;
  equipment: string;
}

export interface ParsedCallsign {
  airlineCode: string | null;
  airlinePrefix: string;
  flightNumber: string;
  suffix: string;
  raw: string;
}

export type Confidence = "low" | "medium" | "high";

export interface RouteInference {
  from: string | null;
  to: string | null;
  confidence: Confidence;
  reasoning: string;
}

export interface InferRouteInput {
  icao24?: string;
  callsign?: string | null;
  lat?: number;
  lon?: number;
}