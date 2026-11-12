import boundaries from "../data/santaRosaBarangays.json";
import { isInsideRing } from "./santaRosa";

export function getBarangayBoundary(name: string) {
  return (
    boundaries.features.find((feature) => feature.properties.name === name) ??
    null
  );
}

/** The form, map and API must agree on the same unambiguous polygon. */
export function validateEntranceBarangay(
  latitude: number,
  longitude: number,
  barangayName: string,
): void {
  if (!getBarangayBoundary(barangayName))
    throw new Error(
      "The selected barangay boundary is unavailable. Reload and try again.",
    );
  const actual = barangayForEntrance(latitude, longitude);
  if (actual !== barangayName)
    throw new Error(
      `Please select an entrance within ${barangayName}. This location is in ${actual}.`,
    );
}

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
