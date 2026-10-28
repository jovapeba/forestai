import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { Territory } from '@/types/environmental';

/** Smoothly re-targets the map when the sovereign territory changes. */
export function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.4 });
  }, [center, zoom, map]);
  return null;
}
