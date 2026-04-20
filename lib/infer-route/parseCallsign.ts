import type { ParsedCallsign } from "./types";

const ICAO_AIRLINE_PREFIXES: Record<string, string> = {
  AAL: "AA",
  AFR: "AF",
  ASA: "AS",
  BAW: "BA",
  DAL: "DL",
  EIN: "EI",
  EZY: "U2",
  JBU: "B6",
  KLM: "KL",
  NKS: "NK",
  QTR: "QR",
  RYR: "FR",
  SAS: "SK",
  SWA: "WN",
  THY: "TK",
  UAE: "EK",
  UAL: "UA",
  VIR: "VS",
};

export function parseCallsign(callsign: string | null | undefined): ParsedCallsign {
  const raw = (callsign || "").trim().toUpperCase();

  if (!raw || raw.length < 2) {
    return {
      airlineCode: null,
      airlinePrefix: "",
      flightNumber: "",
      suffix: "",
      raw,
    };
  }

  const threeCharPrefix = raw.slice(0, 3);
  const twoCharPrefix = raw.slice(0, 2);
  const hasThreeCharPrefix = /^[A-Z]{3}$/.test(threeCharPrefix);
  const hasTwoCharPrefix = /^[A-Z]{2}$/.test(twoCharPrefix);

  let airlineCode: string | null = null;
  let airlinePrefix: string = "";
  let flightNumber = "";
  let suffix = "";

  if (hasThreeCharPrefix) {
    airlinePrefix = threeCharPrefix;
    const digitsMatch = raw.slice(3).match(/^(\d+)(.*)$/);
    if (digitsMatch) {
      flightNumber = digitsMatch[1];
      suffix = digitsMatch[2];
    }
    airlineCode = ICAO_AIRLINE_PREFIXES[threeCharPrefix] || threeCharPrefix;
  } else if (hasTwoCharPrefix) {
    airlinePrefix = twoCharPrefix;
    const digitsMatch = raw.slice(2).match(/^(\d+)(.*)$/);
    if (digitsMatch) {
      flightNumber = digitsMatch[1];
      suffix = digitsMatch[2];
    }
    airlineCode = twoCharPrefix;
  } else {
    const allDigitsMatch = raw.match(/^(\d+)(.*)$/);
    if (allDigitsMatch) {
      flightNumber = allDigitsMatch[1];
      suffix = allDigitsMatch[2];
    }
  }

  return {
    airlineCode,
    airlinePrefix,
    flightNumber,
    suffix,
    raw,
  };
}

export function formatFlightNumber(flightNumber: string): string {
  const normalized = flightNumber.replace(/^0+/, "") || "0";
  return normalized;
}

export function findAirlineByCallsign(
  callsign: string | null
): { iataCode: string | null; icaoCode: string; name: string | null } {
  const parsed = parseCallsign(callsign);

  if (!parsed.airlineCode) {
    return { iataCode: null, icaoCode: "", name: null };
  }

  return {
    iataCode: parsed.airlineCode,
    icaoCode: parsed.airlinePrefix,
    name: null,
  };
}