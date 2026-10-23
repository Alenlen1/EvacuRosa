import { BedDouble, House, UsersRound } from "lucide-react";
import type { ManagedCenter } from "./CenterManager";
import { getBarangayWorkspaceSummary } from "@/lib/barangayWorkspaceSummary";

const numberFormat = new Intl.NumberFormat("en-PH");

export function BarangayWorkspaceSummary({
  centers,
  unavailable = false,
}: {
  centers: ManagedCenter[];
  unavailable?: boolean;
}) {
  const totals = getBarangayWorkspaceSummary(centers);
  const metrics = [
    {
      label: "Centers managed",
      value: totals.centerCount,
      detail: "Assigned to this barangay",
      icon: House,
    },
    {
      label: "Current evacuees",
      value: totals.occupancy,
      detail: "Across assigned centers",
      icon: UsersRound,
    },
    {
      label: "Remaining spaces",
      value: totals.remainingSpaces,
      detail: "At accepting centers",
      icon: BedDouble,
    },
  ];

  return (
    <section
      className="barangay-workspace-summary"
      aria-label="Shelter summary"
    >
      <dl className="barangay-workspace-metrics">
        {metrics.map(({ label, value, detail, icon: Icon }) => {
          const displayedValue = unavailable ? null : value;
          return (
            <div className="barangay-workspace-metric" key={label}>
              <dt>
                <span className="barangay-workspace-metric-icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                {label}
              </dt>
              <dd>
                <span className="barangay-workspace-metric-value">
                  {displayedValue === null ? (
                    <span aria-label="Unavailable">—</span>
                  ) : (
                    numberFormat.format(displayedValue)
                  )}
                </span>
                <span className="barangay-workspace-metric-detail">
                  {detail}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      {unavailable ? (
        <p className="barangay-workspace-summary-note" role="status">
          Shelter summary unavailable.
        </p>
      ) : totals.occupancy === null || totals.remainingSpaces === null ? (
        <p className="barangay-workspace-summary-note" role="status">
          Some shelter totals are unavailable.
        </p>
      ) : null}
    </section>
  );
}
