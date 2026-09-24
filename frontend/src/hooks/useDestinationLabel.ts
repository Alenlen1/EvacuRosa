"use client";

import { useEffect, useState } from "react";
import type { EvacuationCenter, LatLng } from "@/services/api";
import { coordinateLabel, destinationKey, reverseGeocode, type DestinationLabel } from "@/lib/reverseGeocoding";

export function useDestinationLabel(destination: LatLng | null, centers: EvacuationCenter[], online: boolean) {
  const latitude = destination?.latitude;
  const longitude = destination?.longitude;
  const key = destination ? destinationKey(destination.latitude, destination.longitude) : "";
  // Exact coordinate identity only: do not rename an arbitrary nearby point as a shelter.
  const knownCenter = centers.find(center => destinationKey(center.latitude, center.longitude) === key);
  const knownName = knownCenter?.name;
  const knownAddress = knownCenter?.address || knownCenter?.barangayName;
  const [resolved, setResolved] = useState<{ key: string; label: DestinationLabel | null } | null>(null);

  useEffect(() => {
    if (latitude === undefined || longitude === undefined || knownName || !online) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      reverseGeocode(latitude, longitude, controller.signal).then(label => {
        if (!controller.signal.aborted) setResolved({ key, label });
      });
    }, 600);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [latitude, longitude, key, knownName, online]);

  if (knownName) return { label: { title: knownName, subtitle: knownAddress, source: "center" } as DestinationLabel, loading: false };
  if (!destination) return { label: null, loading: false };
  return {
    label: (resolved?.key === key ? resolved.label : null) ?? coordinateLabel(destination.latitude, destination.longitude),
    loading: online && resolved?.key !== key,
  };
}
