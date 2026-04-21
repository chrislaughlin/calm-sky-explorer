"use client";

import { memo, startTransition, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { divIcon, type DivIcon } from "leaflet";
import { MapContainer, Marker, TileLayer, ZoomControl } from "react-leaflet";
import MapBoundsListener from "@/components/map-bounds-listener";
import {
  FALLBACK_BOUNDS,
  FALLBACK_CENTER,
  centerFromBounds,
  formatAirlineLabel,
  formatDistanceKm,
  formatRelativeTime,
  getAirportName,
  haversineKm,
  isLikelyAirbornePlane,
  type BoundsQuery,
  type Plane,
  type PlaneApiResponse,
  viewportBucketForBounds,
} from "@/lib/aviation";
import { getJourneyProgress } from "@/lib/journey-progress";
import { getAirport } from "@/lib/infer-route/data/airports";
import type {
  AirportWeatherIcon,
  AirportWeatherSnapshot,
  RouteWeatherResult,
} from "@/lib/route-weather";

type LocationStatus = "idle" | "locating" | "granted" | "denied" | "unsupported";
type FetchStatus = "idle" | "loading" | "refreshing" | "ready" | "error";

const REFRESH_INTERVAL_MS = 12_000;
const MAX_MARKERS = 32;

function createPlaneIcon(heading: number | null, active: boolean, onGround: boolean): DivIcon {
  return divIcon({
    className: "",
    html: `
      <span class="plane-marker ${active ? "plane-marker--active" : ""} ${onGround ? "plane-marker--grounded" : ""}">
        <svg
          class="plane-marker__icon"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style="--plane-rotation:${heading ?? 0}deg"
        >
          <path
            d="M20.9 3.6 10.7 13.8m10.2-10.2-6.3 16.8-3.9-5.2-5.2-3.9 16.7-7.7Zm-10.2 10.2-3.4 6.6"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
          />
        </svg>
      </span>
    `,
    iconAnchor: [20, 20],
    iconSize: [40, 40],
  });
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5A8.5 8.5 0 0 0 12 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M15.6 8.4 13.8 13.8 8.4 15.6 10.2 10.2 15.6 8.4Z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" />
    </svg>
  );
}

const PlaneMarker = memo(function PlaneMarker({
  plane,
  active,
  onSelect,
}: {
  plane: Plane;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const position = useMemo(
    () => [plane.latitude, plane.longitude] as [number, number],
    [plane.latitude, plane.longitude]
  );
  const icon = useMemo(
    () => createPlaneIcon(plane.heading, active, plane.onGround),
    [active, plane.heading, plane.onGround]
  );
  const handleClick = useCallback(() => {
    onSelect(plane.id);
  }, [onSelect, plane.id]);
  const eventHandlers = useMemo(() => ({ click: handleClick }), [handleClick]);

  return <Marker position={position} icon={icon} eventHandlers={eventHandlers} />;
});

function formatAltitude(plane: Plane) {
  if (plane.altitudeFt == null) {
    return plane.onGround ? "On the ground" : "Altitude unknown";
  }

  return `${plane.altitudeFt.toLocaleString()} ft`;
}

function formatSpeed(plane: Plane) {
  if (plane.speedKts == null) {
    return "Speed unknown";
  }

  return `${plane.speedKts.toLocaleString()} kt`;
}

function WeatherGlyph({ icon }: { icon: AirportWeatherIcon }) {
  switch (icon) {
    case "sun":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <path d="M12 1.75v3.1M12 19.15v3.1M1.75 12h3.1M19.15 12h3.1M4.48 4.48l2.2 2.2M17.32 17.32l2.2 2.2M19.52 4.48l-2.2 2.2M6.68 17.32l-2.2 2.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        </svg>
      );
    case "cloud-sun":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
          <circle cx="9" cy="9" r="3" fill="currentColor" />
          <path d="M5.5 14.5h9.2a3.3 3.3 0 0 0 .2-6.6 5.6 5.6 0 0 0-10.5 1.4A3 3 0 0 0 5.5 14.5Z" fill="currentColor" opacity="0.9" />
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
          <path d="M7.4 17.5h9.7a3.9 3.9 0 0 0 .3-7.8 5.6 5.6 0 0 0-10.8 1.6 3.2 3.2 0 0 0 .8 6.2Z" fill="currentColor" />
        </svg>
      );
    case "rain":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
          <path d="M7.4 13.5h9.7a3.9 3.9 0 0 0 .3-7.8 5.6 5.6 0 0 0-10.8 1.6 3.2 3.2 0 0 0 .8 6.2Z" fill="currentColor" />
          <path d="M8 16.5v2.2M12 16.5v2.2M16 16.5v2.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        </svg>
      );
    case "snow":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
          <path d="M7.4 13.5h9.7a3.9 3.9 0 0 0 .3-7.8 5.6 5.6 0 0 0-10.8 1.6 3.2 3.2 0 0 0 .8 6.2Z" fill="currentColor" />
          <path d="M12 16.4v3.2M10.5 17.2l3 1.4M13.5 17.2l-3 1.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
        </svg>
      );
    case "storm":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
          <path d="M7.4 13.5h9.7a3.9 3.9 0 0 0 .3-7.8 5.6 5.6 0 0 0-10.8 1.6 3.2 3.2 0 0 0 .8 6.2Z" fill="currentColor" />
          <path d="M11 15.5h2l-1 3h2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
        </svg>
      );
    case "fog":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
          <path d="M7.4 11.5h9.7a3.9 3.9 0 0 0 .3-7.8 5.6 5.6 0 0 0-10.8 1.6 3.2 3.2 0 0 0 .8 6.2Z" fill="currentColor" />
          <path d="M5 16h14M6.5 19h11" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
          <circle cx="12" cy="12" r="6" fill="currentColor" opacity="0.5" />
        </svg>
      );
  }
}

function WeatherRow({
  label,
  airport,
  loading,
}: {
  label: string;
  airport: AirportWeatherSnapshot | null;
  loading?: boolean;
}) {
  const icon = airport?.icon ?? "unknown";

  return (
    <div className="rounded-[1.05rem] border border-slate-200/75 bg-white/82 p-2.5 shadow-[0_10px_24px_rgba(122,150,194,0.08)] md:rounded-[1.2rem] md:p-3">
      <div className="flex items-start justify-between gap-2 md:gap-3">
        <div className="min-w-0">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-slate-500 md:text-[0.66rem] md:tracking-[0.22em]">
            {label}
          </p>
          <div className="mt-1 truncate text-[0.92rem] font-semibold text-slate-900 md:text-sm">
            {loading ? (
              <span className="inline-block h-4 w-36 animate-pulse rounded-full bg-slate-200/80" />
            ) : (
              <span>
                {airport?.name ?? "Airport unavailable"}{" "}
                <span className="font-normal text-slate-500">
                  ({airport?.airportCode ?? "—"})
                </span>
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1 text-slate-600 md:gap-2 md:px-2.5">
          {loading ? (
            <span className="h-4 w-4 animate-pulse rounded-full bg-slate-200/80" />
          ) : (
            <WeatherGlyph icon={icon} />
          )}
          <span className="text-[0.68rem] font-medium uppercase tracking-[0.15em] md:text-xs md:tracking-[0.18em]">
            {loading ? "..." : icon}
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-[0.9rem] leading-5 text-slate-600 md:mt-2 md:text-sm md:leading-6">
        {loading ? (
          <span className="inline-block h-4 w-48 animate-pulse rounded-full bg-slate-200/80" />
        ) : (
          airport?.summary ?? "Weather unavailable"
        )}
      </p>
    </div>
  );
}

export default function CalmSkyExplorer() {
  const [center, setCenter] = useState(FALLBACK_CENTER);
  const [bounds, setBounds] = useState<BoundsQuery>(FALLBACK_BOUNDS);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [, setFetchStatus] = useState<FetchStatus>("idle");
  const [planes, setPlanes] = useState<Plane[]>([]);
  const [selectedPlaneId, setSelectedPlaneId] = useState<string | null>(null);
  const [recenterRequestId, setRecenterRequestId] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [routeWeather, setRouteWeather] = useState<RouteWeatherResult | null>(null);
  const [routeWeatherKey, setRouteWeatherKey] = useState<string | null>(null);
  const [routeWeatherErrorKey, setRouteWeatherErrorKey] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(true);

  const autoSelectionHappened = useRef(false);
  const inflightViewportKeyRef = useRef<string | null>(null);
  const latestViewportKeyRef = useRef<string>(viewportBucketForBounds(FALLBACK_BOUNDS).key);

  const closeSelectedPlane = useCallback(() => {
    setSelectedPlaneId(null);
  }, []);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return;
    }

    setLocationStatus("locating");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setLocationStatus("granted");
        setUserLocation(nextCenter);
        setCenter(nextCenter);
        setRecenterRequestId((current) => current + 1);
      },
      () => {
        setLocationStatus("denied");
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 10_000,
      }
    );
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      requestLocation();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [requestLocation]);

  const activeViewport = useMemo(() => viewportBucketForBounds(bounds), [bounds]);
  const viewportCenter = useMemo(
    () => centerFromBounds(activeViewport.bounds),
    [activeViewport.key]
  );

  const rankedPlanes = useMemo(() => {
    return [...planes]
      .filter(isLikelyAirbornePlane)
      .sort(
        (left, right) =>
          haversineKm(
            viewportCenter.lat,
            viewportCenter.lng,
            left.latitude,
            left.longitude
          ) -
          haversineKm(
            viewportCenter.lat,
            viewportCenter.lng,
            right.latitude,
            right.longitude
          )
      )
      .slice(0, MAX_MARKERS);
  }, [planes, viewportCenter.lat, viewportCenter.lng]);

  const selectedPlane = useMemo(() => {
    return rankedPlanes.find((plane) => plane.id === selectedPlaneId) ?? null;
  }, [rankedPlanes, selectedPlaneId]);
  const journeyProgress = useMemo(() => {
    if (!selectedPlane?.origin || !selectedPlane.destination) {
      return null;
    }

    const originAirport = getAirport(selectedPlane.origin);
    const destinationAirport = getAirport(selectedPlane.destination);

    if (!originAirport || !destinationAirport) {
      return null;
    }

    return getJourneyProgress({
      origin: {
        code: selectedPlane.origin,
        lat: originAirport.lat,
        lon: originAirport.lon,
      },
      destination: {
        code: selectedPlane.destination,
        lat: destinationAirport.lat,
        lon: destinationAirport.lon,
      },
      currentPosition: {
        lat: selectedPlane.latitude,
        lon: selectedPlane.longitude,
      },
    });
  }, [selectedPlane]);

  const originWeather =
    selectedPlane?.origin &&
    routeWeather?.origin?.airportCode === selectedPlane.origin
      ? routeWeather.origin
      : null;

  const destinationWeather =
    selectedPlane?.destination &&
    routeWeather?.destination?.airportCode === selectedPlane.destination
      ? routeWeather.destination
      : null;
  const selectedRouteKey =
    selectedPlane?.origin && selectedPlane?.destination
      ? `${selectedPlane.origin}:${selectedPlane.destination}`
      : null;
  const weatherLoading =
    selectedRouteKey != null &&
    routeWeatherKey !== selectedRouteKey &&
    routeWeatherErrorKey !== selectedRouteKey;

  useEffect(() => {
    latestViewportKeyRef.current = activeViewport.key;
  }, [activeViewport.key]);

  useEffect(() => {
    const updateVisibility = () => {
      setIsPageVisible(document.visibilityState !== "hidden");
    };

    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);

    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    const originAirportCode = selectedPlane?.origin;
    const destinationAirportCode = selectedPlane?.destination;

    if (!originAirportCode && !destinationAirportCode) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const params = new URLSearchParams({
      originAirportCode: originAirportCode ?? "",
      destinationAirportCode: destinationAirportCode ?? "",
    });

    fetch(`/api/route-weather?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load route weather.");
        }

        return (await response.json()) as RouteWeatherResult;
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setRouteWeather(payload);
        setRouteWeatherKey(`${originAirportCode}:${destinationAirportCode}`);
        setRouteWeatherErrorKey(null);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setRouteWeather(null);
        setRouteWeatherKey(null);
        setRouteWeatherErrorKey(
          originAirportCode && destinationAirportCode
            ? `${originAirportCode}:${destinationAirportCode}`
            : null
        );
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedPlane?.destination, selectedPlane?.origin]);

  const fetchPlanes = useEffectEvent(async (activeBounds: BoundsQuery) => {
    const activeViewport = viewportBucketForBounds(activeBounds);
    const requestKey = activeViewport.key;

    if (inflightViewportKeyRef.current === requestKey) {
      return;
    }

    inflightViewportKeyRef.current = requestKey;
    setFetchStatus((current) => (current === "ready" ? "refreshing" : "loading"));

    const params = new URLSearchParams({
      north: activeViewport.bounds.north.toString(),
      south: activeViewport.bounds.south.toString(),
      east: activeViewport.bounds.east.toString(),
      west: activeViewport.bounds.west.toString(),
    });

    try {
      const response = await fetch(`/api/planes?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "Unable to load nearby flights.");
      }

      const payload = (await response.json()) as PlaneApiResponse;
      const nextPlanes = payload.planes;

      if (latestViewportKeyRef.current !== requestKey) {
        return;
      }

      const nearestPlaneId =
        [...nextPlanes]
          .filter(isLikelyAirbornePlane)
          .sort(
            (left, right) =>
              haversineKm(
                viewportCenter.lat,
                viewportCenter.lng,
                left.latitude,
                left.longitude
              ) -
              haversineKm(
                viewportCenter.lat,
                viewportCenter.lng,
                right.latitude,
                right.longitude
              )
          )[0]?.id ??
        nextPlanes[0]?.id ??
        null;

      startTransition(() => {
        setPlanes(nextPlanes);
        setSelectedPlaneId((current) => {
          if (current && nextPlanes.some((plane) => plane.id === current)) {
            return current;
          }

          if (!autoSelectionHappened.current) {
            autoSelectionHappened.current = true;
            return nearestPlaneId;
          }

          return null;
        });
      });

      setFetchStatus("ready");
    } catch {
      if (latestViewportKeyRef.current === requestKey) {
        setFetchStatus("error");
      }
    } finally {
      if (inflightViewportKeyRef.current === requestKey) {
        inflightViewportKeyRef.current = null;
      }
    }
  });

  useEffect(() => {
    if (!isPageVisible) {
      return;
    }

    const initialFetch = window.setTimeout(() => {
      void fetchPlanes(activeViewport.bounds);
    }, 0);

    const interval = window.setInterval(() => {
      void fetchPlanes(activeViewport.bounds);
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
    };
  }, [activeViewport.key, isPageVisible]);

  const handleBoundsChange = useCallback((nextBounds: BoundsQuery) => {
    setBounds((current) => {
      const currentKey = viewportBucketForBounds(current).key;
      const nextKey = viewportBucketForBounds(nextBounds).key;

      if (currentKey === nextKey) {
        return current;
      }

      return nextBounds;
    });
  }, []);

  const handlePlaneSelect = useCallback((planeId: string) => {
    setSelectedPlaneId(planeId);
  }, []);

  const returnToLocation = useCallback(() => {
    if (!userLocation) {
      requestLocation();
      return;
    }

    setCenter(userLocation);
    setRecenterRequestId((current) => current + 1);
  }, [requestLocation, userLocation]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,rgba(210,230,255,0.85),rgba(242,248,255,0.95)_42%,rgba(252,253,255,1)_100%)] text-slate-900">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0))]" />

      <section className="absolute inset-x-0 top-0 z-[500] mx-auto flex w-full max-w-screen-sm flex-col gap-3 px-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="max-w-[14.5rem] rounded-[1.65rem] border border-white/80 bg-white/92 px-3.5 py-2.5 shadow-[0_14px_34px_rgba(106,137,181,0.12)] md:bg-white/80 md:backdrop-blur-xl">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-sky-700">
                Calm Sky Explorer
              </p>
              <h1 className="mt-2 text-[1.35rem] font-semibold leading-[1.08] tracking-tight text-slate-950">
                Find the quiet answer
                <br />
                to where that plane is headed.
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={returnToLocation}
            aria-label="Return to my location"
            title="Return to my location"
            className="absolute right-4 top-4 z-[501] inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/80 bg-white/92 text-slate-700 shadow-[0_14px_34px_rgba(118,149,195,0.12)] transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-0.5 md:bg-white/80 md:backdrop-blur-xl"
          >
            <CompassIcon />
          </button>

      </section>

      <div className="absolute inset-0">
        <MapContainer
          center={center}
          className="h-full w-full"
          zoom={8}
          preferCanvas
          fadeAnimation={false}
          markerZoomAnimation={false}
          wheelDebounceTime={80}
          zoomControl={false}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            keepBuffer={3}
            updateWhenIdle
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <ZoomControl position="bottomright" />
          <MapBoundsListener
            center={center}
            recenterRequestId={recenterRequestId}
            onBoundsChange={handleBoundsChange}
          />

          {rankedPlanes.map((plane) => (
            <PlaneMarker
              key={plane.id}
              plane={plane}
              active={plane.id === selectedPlaneId}
              onSelect={handlePlaneSelect}
            />
          ))}
        </MapContainer>
      </div>

      {selectedPlane ? (
        <button
          type="button"
          aria-label="Close flight details"
          className="fixed inset-0 z-[490] cursor-default bg-transparent"
          onClick={closeSelectedPlane}
        />
      ) : null}

      <section className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] mx-auto w-full max-w-screen-sm px-4 pb-4">
        <div className="pointer-events-auto space-y-3">
          {selectedPlane ? (
            <article
              className="sheet-enter max-h-[78dvh] overflow-y-auto rounded-[1.5rem] border border-white/84 bg-white/94 p-3.5 shadow-[0_18px_42px_rgba(103,131,175,0.16)] md:max-h-none md:rounded-[2rem] md:bg-white/86 md:p-5 md:backdrop-blur-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 md:gap-4">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-sky-700 md:text-[0.68rem] md:tracking-[0.24em]">
                    Where are they going?
                  </p>
                  <h2 className="mt-1 text-[1.45rem] font-semibold tracking-tight text-slate-950 md:mt-2 md:text-[1.85rem]">
                    {selectedPlane.displayCallsign}
                  </h2>
                  <p className="mt-1 text-[0.82rem] leading-5 text-slate-600 md:text-sm md:leading-6">
                    {formatAirlineLabel(selectedPlane)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSelectedPlane}
                  className="rounded-full bg-slate-100/90 px-2.5 py-0.5 text-[0.8rem] font-medium text-slate-600 transition-colors hover:bg-slate-200/90 md:px-3 md:py-1 md:text-sm"
                >
                  Close
                </button>
              </div>

              {selectedPlane.origin && selectedPlane.destination ? (
                <div className="mt-3 grid gap-2.5 md:mt-4 md:gap-3">
                  <div className="flex items-center gap-1.5 text-[0.78rem] text-slate-400 md:gap-2 md:text-sm">
                    <span>{getAirportName(selectedPlane.origin)}</span>
                    <span className="text-base md:text-lg">({selectedPlane.origin})</span>
                    <span className="text-slate-300">→</span>
                    <span>{getAirportName(selectedPlane.destination)}</span>
                    <span className="text-base md:text-lg">({selectedPlane.destination})</span>
                  </div>
                  <div className="grid gap-2 md:gap-3 md:grid-cols-2">
                    <WeatherRow
                      label="Origin weather"
                      airport={originWeather}
                      loading={weatherLoading}
                    />
                    <WeatherRow
                      label="Destination weather"
                      airport={destinationWeather}
                      loading={weatherLoading}
                    />
                  </div>
                </div>
              ) : null}

              <dl className="mt-3.5 grid grid-cols-2 gap-2 text-sm md:mt-5 md:gap-3">
                <div className="rounded-[1rem] border border-slate-200/70 bg-slate-50/70 p-2.5 md:rounded-[1.3rem] md:p-3">
                  <dt className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-slate-500 md:text-[0.68rem] md:tracking-[0.2em]">
                    Distance
                  </dt>
                  <dd className="mt-1.5 text-[1.05rem] font-semibold leading-tight text-slate-900 md:mt-2 md:text-base md:leading-normal">
                    {formatDistanceKm(
                      haversineKm(
                        center.lat,
                        center.lng,
                        selectedPlane.latitude,
                        selectedPlane.longitude
                      )
                    )}
                  </dd>
                </div>
                <div className="rounded-[1rem] border border-slate-200/70 bg-slate-50/70 p-2.5 md:rounded-[1.3rem] md:p-3">
                  <dt className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-slate-500 md:text-[0.68rem] md:tracking-[0.2em]">
                    Altitude
                  </dt>
                  <dd className="mt-1.5 text-[1.05rem] font-semibold leading-tight text-slate-900 md:mt-2 md:text-base md:leading-normal">
                    {formatAltitude(selectedPlane)}
                  </dd>
                </div>
                <div className="rounded-[1rem] border border-slate-200/70 bg-slate-50/70 p-2.5 md:rounded-[1.3rem] md:p-3">
                  <dt className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-slate-500 md:text-[0.68rem] md:tracking-[0.2em]">
                    Speed
                  </dt>
                  <dd className="mt-1.5 text-[1.05rem] font-semibold leading-tight text-slate-900 md:mt-2 md:text-base md:leading-normal">
                    {formatSpeed(selectedPlane)}
                  </dd>
                </div>
                <div className="rounded-[1rem] border border-slate-200/70 bg-slate-50/70 p-2.5 md:rounded-[1.3rem] md:p-3">
                  <dt className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-slate-500 md:text-[0.68rem] md:tracking-[0.2em]">
                    Last contact
                  </dt>
                  <dd className="mt-1.5 text-[1.05rem] font-semibold leading-tight text-slate-900 md:mt-2 md:text-base md:leading-normal">
                    {selectedPlane.lastContact
                      ? formatRelativeTime(selectedPlane.lastContact * 1000)
                      : "Just now"}
                  </dd>
                </div>
              </dl>

              {journeyProgress ? (
                <div className="mt-3 space-y-0.5 rounded-[1rem] border border-sky-200/70 bg-sky-50/70 p-2.5 text-[0.9rem] leading-5 text-slate-700 md:mt-4 md:space-y-1.5 md:rounded-[1.3rem] md:p-3 md:text-sm md:leading-6">
                  <p className="font-semibold text-slate-900 md:text-base">
                    {journeyProgress.summary.progress}
                  </p>
                  <p>{journeyProgress.summary.travelled}</p>
                  <p>{journeyProgress.summary.remaining}</p>
                  <p>{journeyProgress.summary.walking}</p>
                </div>
              ) : null}
            </article>
          ) : null}

          {!selectedPlane && (locationStatus === "denied" || locationStatus === "unsupported") ? (
            <div className="pointer-events-auto flex justify-center">
              <button
                type="button"
                onClick={requestLocation}
                className="rounded-full border border-white/80 bg-white/94 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-[0_14px_34px_rgba(112,139,183,0.14)] transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-0.5 md:bg-white/84 md:backdrop-blur-xl"
              >
                Try location again
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
