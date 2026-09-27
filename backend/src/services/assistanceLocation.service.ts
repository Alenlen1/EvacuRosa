import { loadRoadGraph } from "./road.service";

export interface AssistanceLocationName {
  roadName: string;
  distanceMeters: number;
}

/** Local OSM data only: private snapshots never go to an external geocoder.
 * Names are nearby-road references, not verified addresses or route access. */
export function createAssistanceLocationLookup() {
  const cache = new Map<string, AssistanceLocationName | null>();
  return (latitude: number | null, longitude: number | null): AssistanceLocationName | null => {
    if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const key = `${latitude},${longitude}`;
    if (cache.has(key)) return cache.get(key)!;
    let label: AssistanceLocationName | null = null;
    try {
      const nearest = loadRoadGraph().nearestRoads(latitude, longitude, 1)[0];
      const roadName = nearest?.roadName?.trim();
      // Do not substitute a distant named road for a closer unnamed street.
      if (roadName && nearest.distanceMeters <= 150) {
        label = { roadName, distanceMeters: nearest.distanceMeters };
      }
    } catch {
      // Missing road data must not hide a person's shared location.
    }
    cache.set(key, label);
    return label;
  };
}
