import { barangayForEntrance } from "../../../backend/src/geography/barangayBoundary";

export function entranceBarangay(
  latitude: string,
  longitude: string,
  barangays: readonly { id: string; name: string }[],
): { barangay: { id: string; name: string } | null; message: string } {
  if (!latitude.trim() || !longitude.trim())
    return {
      barangay: null,
      message:
        "Select an entrance or enter both coordinates to assign its barangay.",
    };
  try {
    const name = barangayForEntrance(Number(latitude), Number(longitude));
    const barangay = barangays.find((entry) => entry.name === name);
    return barangay
      ? {
          barangay,
          message: "Assigned automatically from the entrance location.",
        }
      : {
          barangay: null,
          message: `The entrance is in ${name}. Its barangay record could not be loaded. Reload and try again.`,
        };
  } catch (error) {
    return {
      barangay: null,
      message:
        error instanceof Error ? error.message : "Check the entrance location.",
    };
  }
}
