"use client";

import { memo, startTransition, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { divIcon, type DivIcon } from "leaflet";
import { MapContainer, Marker, TileLayer, ZoomControl } from "react-leaflet";
import MapBoundsListener from "@/components/map-bounds-listener";
import {
  FALLBACK_BOUNDS,
  FALLBACK_CENTER,
  boundsAroundPoint,
  formatAirlineLabel,
  formatDistanceKm,
  formatRelativeTime,
  getAirportName,
  haversineKm,
  isLikelyAirbornePlane,
  type BoundsQuery,
  type Plane,
  type PlaneApiResponse,
} from "@/lib/aviation";

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

function statusCopy(
  locationStatus: LocationStatus,
  fetchStatus: FetchStatus
) {
  if (fetchStatus === "loading") {
    return "Loading nearby aircraft";
  }

  if (locationStatus === "locating") {
    return "Centering on your location";
  }

  if (locationStatus === "denied") {
    return "Location is off, showing a sample sky";
  }

  if (locationStatus === "unsupported") {
    return "Geolocation is unavailable on this device";
  }

  return "Nearby live aircraft";
}

export default function CalmSkyExplorer() {
  const [center, setCenter] = useState(FALLBACK_CENTER);
  const [bounds, setBounds] = useState<BoundsQuery>(FALLBACK_BOUNDS);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [planes, setPlanes] = useState<Plane[]>([]);
  const [selectedPlaneId, setSelectedPlaneId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [recenterRequestId, setRecenterRequestId] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const autoSelectionHappened = useRef(false);

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
        setBounds(boundsAroundPoint(nextCenter.lat, nextCenter.lng, 1.1, 1.45));
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

  const rankedPlanes = useMemo(() => {
    return [...planes]
      .filter(isLikelyAirbornePlane)
      .sort(
        (left, right) =>
          haversineKm(center.lat, center.lng, left.latitude, left.longitude) -
          haversineKm(center.lat, center.lng, right.latitude, right.longitude)
      )
      .slice(0, MAX_MARKERS);
  }, [center.lat, center.lng, planes]);

  const selectedPlane = useMemo(() => {
    return rankedPlanes.find((plane) => plane.id === selectedPlaneId) ?? null;
  }, [rankedPlanes, selectedPlaneId]);

  const fetchPlanes = useEffectEvent(async (activeBounds: BoundsQuery) => {
    setFetchStatus((current) => (current === "ready" ? "refreshing" : "loading"));

    const params = new URLSearchParams({
      north: activeBounds.north.toString(),
      south: activeBounds.south.toString(),
      east: activeBounds.east.toString(),
      west: activeBounds.west.toString(),
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
      const nearestPlaneId =
        [...nextPlanes]
          .filter(isLikelyAirbornePlane)
          .sort(
            (left, right) =>
              haversineKm(center.lat, center.lng, left.latitude, left.longitude) -
              haversineKm(center.lat, center.lng, right.latitude, right.longitude)
          )[0]?.id ??
        nextPlanes[0]?.id ??
        null;

      startTransition(() => {
        setPlanes(nextPlanes);
        setLastUpdated(payload.meta.fetchedAt);
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
      setFetchStatus("error");
    }
  });

  useEffect(() => {
    const initialFetch = window.setTimeout(() => {
      void fetchPlanes(bounds);
    }, 0);

    const interval = window.setInterval(() => {
      void fetchPlanes(bounds);
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
    };
  }, [bounds]);

  const handleBoundsChange = useCallback((nextBounds: BoundsQuery) => {
    setBounds(nextBounds);
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
    setBounds(boundsAroundPoint(userLocation.lat, userLocation.lng, 1.1, 1.45));
    setRecenterRequestId((current) => current + 1);
  }, [requestLocation, userLocation]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,rgba(210,230,255,0.85),rgba(242,248,255,0.95)_42%,rgba(252,253,255,1)_100%)] text-slate-900">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0))]" />

      <section className="absolute inset-x-0 top-0 z-[500] mx-auto flex w-full max-w-screen-sm flex-col gap-3 px-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="max-w-[15rem] rounded-[1.65rem] border border-white/80 bg-white/92 px-4 py-3 shadow-[0_14px_34px_rgba(106,137,181,0.12)] md:bg-white/80 md:backdrop-blur-xl">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-sky-700">
                Calm Sky Explorer
              </p>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                Find the quiet answer to where that plane is headed.
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

        <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-white/80 bg-white/92 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-[0_12px_28px_rgba(122,150,194,0.12)] md:bg-white/80 md:backdrop-blur-xl">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span>{statusCopy(locationStatus, fetchStatus)}</span>
          {lastUpdated ? <span>• updated {formatRelativeTime(lastUpdated)}</span> : null}
        </div>
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

      <section className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] mx-auto w-full max-w-screen-sm px-4 pb-4">
        <div className="pointer-events-auto space-y-3">
          {selectedPlane ? (
            <article className="sheet-enter rounded-[2rem] border border-white/84 bg-white/94 p-5 shadow-[0_18px_42px_rgba(103,131,175,0.16)] md:bg-white/86 md:backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-sky-700">
                    Where are they going?
                  </p>
                  <h2 className="mt-2 text-[1.85rem] font-semibold tracking-tight text-slate-950">
                    {selectedPlane.displayCallsign}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {formatAirlineLabel(selectedPlane)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPlaneId(null)}
                  className="rounded-full bg-slate-100/90 px-3 py-1 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200/90"
                >
                  Close
                </button>
              </div>

              {selectedPlane.origin && selectedPlane.destination ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                  <span>{getAirportName(selectedPlane.origin)}</span>
                  <span className="text-lg">({selectedPlane.origin})</span>
                  <span className="text-slate-300">→</span>
                  <span>{getAirportName(selectedPlane.destination)}</span>
                  <span className="text-lg">({selectedPlane.destination})</span>
                </div>
              ) : null}

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-[1.3rem] border border-slate-200/70 bg-slate-50/70 p-3">
                  <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Distance
                  </dt>
                  <dd className="mt-2 text-base font-semibold text-slate-900">
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
                <div className="rounded-[1.3rem] border border-slate-200/70 bg-slate-50/70 p-3">
                  <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Altitude
                  </dt>
                  <dd className="mt-2 text-base font-semibold text-slate-900">
                    {formatAltitude(selectedPlane)}
                  </dd>
                </div>
                <div className="rounded-[1.3rem] border border-slate-200/70 bg-slate-50/70 p-3">
                  <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Speed
                  </dt>
                  <dd className="mt-2 text-base font-semibold text-slate-900">
                    {formatSpeed(selectedPlane)}
                  </dd>
                </div>
                <div className="rounded-[1.3rem] border border-slate-200/70 bg-slate-50/70 p-3">
                  <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Last contact
                  </dt>
                  <dd className="mt-2 text-base font-semibold text-slate-900">
                    {selectedPlane.lastContact
                      ? formatRelativeTime(selectedPlane.lastContact * 1000)
                      : "Just now"}
                  </dd>
                </div>
              </dl>
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
