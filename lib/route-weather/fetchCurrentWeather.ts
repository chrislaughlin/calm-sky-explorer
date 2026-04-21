import { formatWeatherSummary } from "./formatWeatherSummary";
import { mapWeatherCodeToIcon } from "./mapWeatherCodeToIcon";
import type { WeatherPoint, WeatherReading } from "./types";

const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

type OpenMeteoCurrent = {
  time?: string;
  temperature_2m?: number;
  weather_code?: number;
  wind_speed_10m?: number;
};

type OpenMeteoLocationResponse = {
  current?: OpenMeteoCurrent;
  timezone_abbreviation?: string;
};

type OpenMeteoResponse = OpenMeteoLocationResponse | OpenMeteoLocationResponse[];

function normalizeReading(payload: OpenMeteoCurrent | undefined): WeatherReading {
  return {
    localTime: typeof payload?.time === "string" ? payload.time : null,
    timeZoneAbbr: null,
    temperatureC:
      typeof payload?.temperature_2m === "number" ? payload.temperature_2m : null,
    weatherCode:
      typeof payload?.weather_code === "number" ? payload.weather_code : null,
    windSpeedKph:
      typeof payload?.wind_speed_10m === "number" ? payload.wind_speed_10m : null,
  };
}

export async function fetchCurrentWeatherBatch(
  locations: WeatherPoint[]
): Promise<WeatherReading[]> {
  if (locations.length === 0) {
    return [];
  }

  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set(
    "latitude",
    locations.map((location) => location.lat.toString()).join(",")
  );
  url.searchParams.set(
    "longitude",
    locations.map((location) => location.lon.toString()).join(",")
  );
  url.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m");
  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo returned ${response.status}`);
  }

  const payload = (await response.json()) as OpenMeteoResponse;
  const entries = Array.isArray(payload) ? payload : [payload];

  return locations.map((_, index) => {
    const entry = entries[index];
    const reading = normalizeReading(entry?.current);

    return {
      ...reading,
      timeZoneAbbr:
        typeof entry?.timezone_abbreviation === "string"
          ? entry.timezone_abbreviation
          : null,
    };
  });
}

export async function fetchCurrentWeather(
  location: WeatherPoint
): Promise<WeatherReading> {
  const [reading] = await fetchCurrentWeatherBatch([location]);
  return (
    reading ?? {
      localTime: null,
      timeZoneAbbr: null,
      temperatureC: null,
      weatherCode: null,
      windSpeedKph: null,
    }
  );
}

export function snapshotWeatherReading(reading: WeatherReading) {
  return {
    ...reading,
    icon: mapWeatherCodeToIcon(reading.weatherCode),
    summary: formatWeatherSummary(reading),
  };
}
