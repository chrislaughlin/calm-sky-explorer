import type { Route } from "../types";
import routesJson from "./routes.json";

export const routesData: Route[] = routesJson as Route[];

export function getRoutesByAirline(airline: string): Route[] {
  const search = airline.toUpperCase();
  return routesData.filter((r) => r.airline === search);
}

export function getAllAirlines(): string[] {
  const airlines = new Set(routesData.map((r) => r.airline));
  return Array.from(airlines).sort();
}