import type { ManagedCenter } from "@/components/admin/CenterManager";

type WorkspaceCenter = Pick<
  ManagedCenter,
  "capacity" | "current_occupancy" | "status"
>;

export interface BarangayWorkspaceTotals {
  centerCount: number;
  occupancy: number | null;
  remainingSpaces: number | null;
}

function isValidCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isAcceptingCenter(center: WorkspaceCenter): boolean {
  return (
    (center.status === "AVAILABLE" || center.status === "NEARLY_FULL") &&
    isValidCount(center.capacity) &&
    isValidCount(center.current_occupancy) &&
    center.current_occupancy < center.capacity
  );
}

/** Summarize saved centers for a barangay or citywide workspace. */
export function getBarangayWorkspaceSummary(
  centers: readonly WorkspaceCenter[],
): BarangayWorkspaceTotals {
  let occupancy: number | null = 0;
  let remainingSpaces: number | null = 0;

  for (const center of centers) {
    const current = center.current_occupancy;
    if (occupancy !== null) {
      occupancy = isValidCount(current) ? occupancy + current : null;
      if (!isValidCount(occupancy)) occupancy = null;
    }

    if (remainingSpaces === null) continue;
    if (center.status === "FULL" || center.status === "CLOSED") continue;
    if (
      (center.status !== "AVAILABLE" && center.status !== "NEARLY_FULL") ||
      !isValidCount(center.capacity) ||
      !isValidCount(current)
    ) {
      remainingSpaces = null;
      continue;
    }

    remainingSpaces += Math.max(center.capacity - current, 0);
    if (!isValidCount(remainingSpaces)) remainingSpaces = null;
  }

  return { centerCount: centers.length, occupancy, remainingSpaces };
}
