import {
  getBarangayBoundary,
  validateEntranceBarangay,
} from "../../../backend/src/geography/barangayBoundary";

export type EntranceBarangay = { id: string; name: string };

export function entranceBarangay(
  latitude: string,
  longitude: string,
  barangays: readonly EntranceBarangay[],
  barangayId: string,
): { barangay: EntranceBarangay | null; valid: boolean; message: string } {
  const barangay = barangays.find((entry) => entry.id === barangayId) ?? null;
  if (!barangay)
    return {
      barangay: null,
      valid: false,
      message: "Choose an assigned barangay before selecting the entrance.",
    };
  if (!getBarangayBoundary(barangay.name))
    return {
      barangay,
      valid: false,
      message:
        "The selected barangay boundary is unavailable. Reload and try again.",
    };
  if (!latitude.trim() || !longitude.trim())
    return {
      barangay,
      valid: false,
      message: `Select an entrance on the map or enter both coordinates within ${barangay.name}.`,
    };
  try {
    validateEntranceBarangay(
      Number(latitude),
      Number(longitude),
      barangay.name,
    );
    return {
      barangay,
      valid: true,
      message: `Entrance is within ${barangay.name}.`,
    };
  } catch (error) {
    return {
      barangay,
      valid: false,
      message:
        error instanceof Error ? error.message : "Check the entrance location.",
    };
  }
}
