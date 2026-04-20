"use client";

import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { boundsFromLeafletBounds, type BoundsQuery } from "@/lib/aviation";

type MapBoundsListenerProps = {
  center: {
    lat: number;
    lng: number;
  };
  recenterRequestId?: number;
  onBoundsChange: (bounds: BoundsQuery) => void;
};

export default function MapBoundsListener({
  center,
  recenterRequestId,
  onBoundsChange,
}: MapBoundsListenerProps) {
  const map = useMap();

  useMapEvents({
    moveend() {
      onBoundsChange(boundsFromLeafletBounds(map.getBounds()));
    },
  });

  useEffect(() => {
    onBoundsChange(boundsFromLeafletBounds(map.getBounds()));
  }, [map, onBoundsChange]);

  useEffect(() => {
    map.flyTo(center, Math.max(map.getZoom(), 8), {
      animate: true,
      duration: 1.2,
    });
  }, [center, map, recenterRequestId]);

  return null;
}
