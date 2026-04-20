import { describeWeatherCode } from "./mapWeatherCodeToIcon";
import type { WeatherReading } from "./types";

function formatTemperature(value: number) {
  return `${Math.round(value)}°C`;
}

function formatWind(value: number) {
  return `${Math.round(value)} km/h wind`;
}

export function formatWeatherSummary(reading: WeatherReading) {
  const parts: string[] = [];
  const description = describeWeatherCode(reading.weatherCode);

  if (reading.temperatureC != null) {
    parts.push(formatTemperature(reading.temperatureC));
  }

  if (description) {
    parts.push(description);
  }

  if (reading.windSpeedKph != null) {
    parts.push(formatWind(reading.windSpeedKph));
  }

  if (parts.length === 0) {
    return "Weather unavailable";
  }

  return parts.join(" · ");
}

