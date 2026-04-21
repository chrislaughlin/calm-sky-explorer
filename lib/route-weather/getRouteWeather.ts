import { lookupAirport } from "./lookupAirport";
import { fetchCurrentWeatherBatch, snapshotWeatherReading } from "./fetchCurrentWeather";
import type {
  AirportWeatherSnapshot,
  RouteWeatherResult,
  WeatherPoint,
} from "./types";

function normalizeAirportSnapshot(
  airportCode: string,
  airport: ReturnType<typeof lookupAirport>,
  weather: ReturnType<typeof snapshotWeatherReading> | null
): AirportWeatherSnapshot {
  return {
    airportCode,
    name: airport?.name ?? null,
    lat: airport?.lat ?? null,
    lon: airport?.lon ?? null,
    localTime: weather?.localTime ?? null,
    timeZoneAbbr: weather?.timeZoneAbbr ?? null,
    temperatureC: weather?.temperatureC ?? null,
    weatherCode: weather?.weatherCode ?? null,
    windSpeedKph: weather?.windSpeedKph ?? null,
    icon: weather?.icon ?? "unknown",
    summary:
      weather?.summary ??
      (airport ? "Weather unavailable" : "Weather unavailable"),
  };
}

function buildWeatherPoint(airport: ReturnType<typeof lookupAirport>): WeatherPoint {
  return {
    lat: airport?.lat ?? 0,
    lon: airport?.lon ?? 0,
  };
}

export async function getRouteWeather(input: {
  originAirportCode: string;
  destinationAirportCode: string;
}): Promise<RouteWeatherResult> {
  const originCode = input.originAirportCode?.trim().toUpperCase() ?? "";
  const destinationCode = input.destinationAirportCode?.trim().toUpperCase() ?? "";

  const originAirport = lookupAirport(originCode);
  const destinationAirport = lookupAirport(destinationCode);

  const resolved: Array<{
    airportCode: string;
    airport: ReturnType<typeof lookupAirport>;
  }> = [];

  if (originAirport) {
    resolved.push({ airportCode: originCode, airport: originAirport });
  }

  if (
    destinationAirport &&
    destinationCode !== originCode
  ) {
    resolved.push({
      airportCode: destinationCode,
      airport: destinationAirport,
    });
  }

  let weatherReadings = new Map<string, ReturnType<typeof snapshotWeatherReading>>();

  if (resolved.length > 0) {
    try {
      const fetched = await fetchCurrentWeatherBatch(
        resolved.map((entry) => buildWeatherPoint(entry.airport))
      );

      weatherReadings = new Map(
        resolved.map((entry, index) => [
          entry.airportCode,
          snapshotWeatherReading(fetched[index] ?? {
            localTime: null,
            timeZoneAbbr: null,
            temperatureC: null,
            weatherCode: null,
            windSpeedKph: null,
          }),
        ])
      );
    } catch {
      weatherReadings = new Map();
    }
  }

  const origin =
    originAirport != null
      ? normalizeAirportSnapshot(
          originCode,
          originAirport,
          weatherReadings.get(originCode) ?? null
        )
      : null;

  const destination =
    destinationAirport != null
      ? normalizeAirportSnapshot(
          destinationCode,
          destinationAirport,
          weatherReadings.get(destinationCode) ?? null
        )
      : null;

  return {
    origin,
    destination,
  };
}
