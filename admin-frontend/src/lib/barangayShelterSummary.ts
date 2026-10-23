import type { EvacuationCenter } from "@/services/api";

export interface BarangayShelterSummary {
  status: EvacuationCenter["status"] | "NONE";
  label: string;
  detail: string;
}

/** Summarize the API's derived statuses, using the assigned barangay ID. */
export function getBarangayShelterSummary(
  barangayId: string,
  centers: readonly Pick<EvacuationCenter, "barangayId" | "status">[],
): BarangayShelterSummary {
  const counts = { AVAILABLE: 0, NEARLY_FULL: 0, FULL: 0, CLOSED: 0 };
  for (const center of centers) {
    if (center.barangayId === barangayId) counts[center.status] += 1;
  }

  const accepting = counts.AVAILABLE + counts.NEARLY_FULL;
  const total = accepting + counts.FULL + counts.CLOSED;
  if (total === 0) {
    return {
      status: "NONE",
      label: "No shelters registered",
      detail: "No shelter listed for this barangay.",
    };
  }

  if (accepting > 0) {
    const status = counts.AVAILABLE > 0 ? "AVAILABLE" : "NEARLY_FULL";
    return {
      status,
      label: status === "AVAILABLE" ? "Available" : "Nearly full",
      detail:
        total === 1
          ? "1 shelter accepting evacuees."
          : `${accepting} of ${total} shelters accepting evacuees.`,
    };
  }

  if (counts.FULL > 0) {
    const full = `${counts.FULL} ${counts.FULL === 1 ? "shelter" : "shelters"} full`;
    return {
      status: "FULL",
      label: "No available shelters",
      detail: counts.CLOSED > 0 ? `${full}; ${counts.CLOSED} closed.` : `${full}.`,
    };
  }

  return {
    status: "CLOSED",
    label: "Shelters closed",
    detail: `${counts.CLOSED} ${counts.CLOSED === 1 ? "shelter" : "shelters"} closed.`,
  };
}
