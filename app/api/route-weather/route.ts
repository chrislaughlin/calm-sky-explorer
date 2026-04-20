import type { NextRequest } from "next/server";
import { JSON_HEADERS } from "@/lib/aviation";
import { getRouteWeather } from "@/lib/route-weather";

export const runtime = "nodejs";

function parseAirportCode(request: NextRequest, key: string) {
  const value = request.nextUrl.searchParams.get(key);
  return value?.trim() || "";
}

export async function GET(request: NextRequest) {
  const originAirportCode = parseAirportCode(request, "originAirportCode");
  const destinationAirportCode = parseAirportCode(
    request,
    "destinationAirportCode"
  );

  if (!originAirportCode && !destinationAirportCode) {
    return Response.json(
      { error: "Missing airport codes" },
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const result = await getRouteWeather({
    originAirportCode,
    destinationAirportCode,
  });

  return Response.json(result, { headers: JSON_HEADERS });
}

