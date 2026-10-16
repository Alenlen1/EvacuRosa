import type { LatLng } from "@/services/api";

export function hazardCoordinates(point?: LatLng): string {
  return point &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude)
    ? `Lat: ${point.latitude.toFixed(6)}, Lng: ${point.longitude.toFixed(6)}`
    : "Coordinates unavailable";
}

/** A representative point on the mapped road, not the original report click. */
export function roadCoordinates(segments?: LatLng[][]): string {
  const segment = segments?.find((points) => points.length >= 2);
  if (!segment) return hazardCoordinates();
  return hazardCoordinates({
    latitude: (segment[0].latitude + segment[1].latitude) / 2,
    longitude: (segment[0].longitude + segment[1].longitude) / 2,
  });
}

/** Bound concurrent deletes and retain failures so staff can retry them. */
export async function removeHazardBatch(tasks: (() => Promise<unknown>)[]) {
  let removed = 0;
  for (let offset = 0; offset < tasks.length; offset += 5) {
    const results = await Promise.allSettled(
      tasks
        .slice(offset, offset + 5)
        .map((task) => Promise.resolve().then(task)),
    );
    removed += results.filter((result) => result.status === "fulfilled").length;
  }
  return { removed, failed: tasks.length - removed };
}
