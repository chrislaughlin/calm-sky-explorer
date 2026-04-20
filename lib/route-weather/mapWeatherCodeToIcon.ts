import type { AirportWeatherIcon } from "./types";

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

export function mapWeatherCodeToIcon(
  weatherCode: number | null | undefined
): AirportWeatherIcon {
  if (weatherCode == null || Number.isNaN(weatherCode)) {
    return "unknown";
  }

  if (weatherCode === 0) return "sun";
  if (weatherCode === 1 || weatherCode === 2) return "cloud-sun";
  if (weatherCode === 3) return "cloud";
  if (
    weatherCode === 45 ||
    weatherCode === 48
  ) {
    return "fog";
  }
  if (
    weatherCode === 51 ||
    weatherCode === 53 ||
    weatherCode === 55 ||
    weatherCode === 56 ||
    weatherCode === 57 ||
    weatherCode === 61 ||
    weatherCode === 63 ||
    weatherCode === 65 ||
    weatherCode === 66 ||
    weatherCode === 67 ||
    weatherCode === 80 ||
    weatherCode === 81 ||
    weatherCode === 82
  ) {
    return "rain";
  }
  if (
    weatherCode === 71 ||
    weatherCode === 73 ||
    weatherCode === 75 ||
    weatherCode === 77 ||
    weatherCode === 85 ||
    weatherCode === 86
  ) {
    return "snow";
  }
  if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
    return "storm";
  }

  return "unknown";
}

export function describeWeatherCode(weatherCode: number | null | undefined) {
  if (weatherCode == null || Number.isNaN(weatherCode)) {
    return null;
  }

  return WEATHER_CODE_LABELS[weatherCode] ?? null;
}

