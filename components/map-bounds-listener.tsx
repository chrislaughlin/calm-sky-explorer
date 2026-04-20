"use client";

import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { boundsAroundPoint, boundsFromLeafletBounds, type BoundsQuery } from "@/lib/aviation";

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
    map.flyTo(center, Math.max(map.getZoom(), 8), {
      animate: true,
      duration: 1.2,
    });
  }, [center, map, recenterRequestId]);

  useEffect(() => {
    onBoundsChange(boundsAroundPoint(center.lat, center.lng, 1.1, 1.45));
  }, [center, onBoundsChange]);

  return null;
}
