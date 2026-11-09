import boundaries from "../data/santaRosaBarangays.json";
import { isInsideRing } from "./santaRosa";

/** Use the published polygons, never a nearest centroid or bounding box. */
export function barangayForEntrance(
  latitude: number,
  longitude: number,
): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
    throw new Error("Provide valid entrance coordinates.");

  const matches = boundaries.features.filter(({ geometry }) => {
    const [outer, ...holes] = geometry.coordinates;
    return (
      isInsideRing(latitude, longitude, outer) &&
      !holes.some((hole) => isInsideRing(latitude, longitude, hole))
    );
  });
  if (!matches.length)
    throw new Error(
      "Select an entrance inside a Santa Rosa barangay boundary.",
    );
  if (matches.length !== 1)
    throw new Error(
      "This entrance is on a shared barangay boundary. Select the entrance clearly inside its barangay.",
    );
  return matches[0].properties.name;
}
