export interface CdrrmoShelterStatusCounts {
  AVAILABLE: number;
  NEARLY_FULL: number;
  FULL: number;
  CLOSED: number;
}

/** Count each center's saved status without treating nearly full as available. */
export function getCdrrmoShelterStatusCounts(
  centers: readonly { status: string }[],
): CdrrmoShelterStatusCounts {
  const counts: CdrrmoShelterStatusCounts = {
    AVAILABLE: 0,
    NEARLY_FULL: 0,
    FULL: 0,
    CLOSED: 0,
  };

  for (const center of centers) {
    switch (center.status) {
      case "AVAILABLE":
      case "NEARLY_FULL":
      case "FULL":
      case "CLOSED":
        counts[center.status]++;
    }
  }

  return counts;
}
