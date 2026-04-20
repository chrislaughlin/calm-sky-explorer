import { getRouteWeather } from "./getRouteWeather";

async function main() {
  const snapshot = await getRouteWeather({
    originAirportCode: "EGAA",
    destinationAirportCode: "EGCC",
  });

  console.log(JSON.stringify(snapshot, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

