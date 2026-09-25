// An explicit planning assumption, not a live or hazard-adjusted ETA.
export const TRAVEL_MODES = {
  walking: { label: "Walking", speedKmh: 4 },
  biking: { label: "Biking", speedKmh: 12 },
  motorcycle: { label: "Motorcycle", speedKmh: 25 },
  car: { label: "Car", speedKmh: 20 },
} as const;

export type TravelMode = keyof typeof TRAVEL_MODES;

export function estimatedTravelTime(distanceMeters: number, mode: TravelMode): string | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
  const minutes = Math.ceil((distanceMeters / 1000 / TRAVEL_MODES[mode].speedKmh) * 60);
  if (minutes < 1) return "Less than 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} hr${remainder ? ` ${remainder} min` : ""}`;
}
