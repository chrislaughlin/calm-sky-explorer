import type { Airport } from "../infer-route/types";

export type AirportWeatherIcon =
  | "sun"
  | "cloud-sun"
  | "cloud"
  | "rain"
  | "snow"
  | "storm"
  | "fog"
  | "unknown";

export type AirportWeatherSnapshot = {
  airportCode: string;
  name: string | null;
  lat: number | null;
  lon: number | null;
  temperatureC: number | null;
  weatherCode: number | null;
  windSpeedKph: number | null;
  icon: AirportWeatherIcon;
  summary: string;
};

export type RouteWeatherResult = {
  origin: AirportWeatherSnapshot | null;
  destination: AirportWeatherSnapshot | null;
};

export type AirportMetadata = Airport;

export type WeatherPoint = {
  lat: number;
  lon: number;
};

export type WeatherReading = {
  temperatureC: number | null;
  weatherCode: number | null;
  windSpeedKph: number | null;
};

