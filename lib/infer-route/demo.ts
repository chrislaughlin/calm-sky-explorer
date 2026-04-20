import { inferRoute } from "./inferRoute";

console.log("=== Flight Route Inference Demo ===");

const tests = [
  { callsign: "FR456", lat: 53.3, lon: -6.2, desc: "Ryanair near Dublin" },
  { callsign: "BA249", lat: 51.5, lon: -0.5, desc: "British Airways near London" },
  { callsign: "EZY856", lat: 52.3, lon: 4.8, desc: "easyJet near Amsterdam" },
  { callsign: "DL123", lat: 40.6, lon: -73.8, desc: "Delta near NYC" },
  { callsign: "AF009", lat: 49.0, lon: 2.5, desc: "Air France near CDG" },
];

for (const t of tests) {
  const r = inferRoute({ callsign: t.callsign, lat: t.lat, lon: t.lon });
  console.log(`\n${t.desc} (${t.callsign}):`);
  console.log(`  ${r.from} → ${r.to} [${r.confidence}]`);
  console.log(`  ${r.reasoning}`);
}

console.log("\n=== Edge Cases ===");
const edge = [
  { callsign: "", desc: "empty" },
  { callsign: "???", desc: "garbage" },
  { callsign: "A1B2C3", desc: "short number" },
];
for (const t of edge) {
  const r = inferRoute({ callsign: t.callsign });
  console.log(`\n${t.desc} (${t.callsign || "(empty)"}): ${r.confidence} - ${r.reasoning.substring(0, 60)}`);
}