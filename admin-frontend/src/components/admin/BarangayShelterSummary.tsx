import { CircleCheck, CircleMinus, House, TriangleAlert } from "lucide-react";
import type { EvacuationCenter } from "@/services/api";

export function BarangayShelterSummary({
  centers,
  loading,
  error,
}: {
  centers: EvacuationCenter[] | null;
  loading: boolean;
  error: string;
}) {
  const available = !loading && !error && centers !== null;
  const metrics = [
    {
      label: "Total shelters",
      count: centers?.length,
      Icon: House,
      tone: "total",
    },
    {
      label: "Available",
      count: centers?.filter((center) => center.status === "AVAILABLE").length,
      Icon: CircleCheck,
      tone: "available",
    },
    {
      label: "Nearly full",
      count: centers?.filter((center) => center.status === "NEARLY_FULL")
        .length,
      Icon: TriangleAlert,
      tone: "nearly-full",
    },
    {
      label: "Full",
      count: centers?.filter((center) => center.status === "FULL").length,
      Icon: CircleMinus,
      tone: "full",
    },
  ];

  return (
    <section
      className="barangay-city-summary"
      aria-label="City shelter summary"
      aria-busy={loading}
    >
      <h2 className="barangay-summary-heading">City shelter overview</h2>
      <dl className="barangay-summary-metrics">
        {metrics.map(({ label, count, Icon, tone }) => (
          <div className="barangay-summary-metric" data-tone={tone} key={label}>
            <dt>
              <span className="barangay-summary-icon" aria-hidden="true">
                <Icon size={19} />
              </span>
              {label}
            </dt>
            <dd>{available ? count : "—"}</dd>
          </div>
        ))}
      </dl>
      {(!available || centers.length === 0) && (
        <p className="barangay-summary-note" role="status">
          {loading
            ? "Loading city shelter summary..."
            : !available
              ? "Shelter summary unavailable. Refresh the map to try again."
              : "No shelters registered in the city yet."}
        </p>
      )}
    </section>
  );
}
