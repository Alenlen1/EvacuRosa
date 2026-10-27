import {
  ArrowUpRight,
  CircleCheck,
  Flame,
  House,
  TriangleAlert,
  UsersRound,
  Waves,
} from "lucide-react";
import type { ManagedCenter } from "./CenterManager";
import { SkeletonBlock } from "./Skeleton";
import styles from "./CdrrmoDashboard.module.css";
import { SharedLocationsPreview } from "./SharedLocationsPreview";
import {
  getBarangayWorkspaceSummary,
  isAcceptingCenter,
} from "@/lib/barangayWorkspaceSummary";

export interface DashboardHazards {
  floods: number | null;
  fires: number | null;
  earthquakes: number | null;
}

export function CdrrmoDashboard({
  centers,
  centersUnavailable,
  hazards,
  hazardsLoading,
}: {
  centers: ManagedCenter[];
  centersUnavailable: boolean;
  hazards: DashboardHazards;
  hazardsLoading: boolean;
}) {
  const available = centers.filter(isAcceptingCenter);
  const totals = getBarangayWorkspaceSummary(centers);
  const metrics = [
    {
      label: "Registered centers",
      value: centers.length,
      description: "Across Santa Rosa City",
      icon: House,
    },
    {
      label: "Available centers",
      value: available.length,
      description: "Includes nearly full centers",
      icon: CircleCheck,
      tone: "safe",
    },
    {
      label: "Reported occupants",
      value: totals.occupancy,
      description: "Latest counts from barangays",
      icon: UsersRound,
    },
    {
      label: "Available spaces",
      value: totals.remainingSpaces,
      description: "At centers accepting evacuees",
      icon: House,
      tone: "safe",
    },
  ];
  const hazardRows = [
    {
      label: "Flood reports",
      value: hazards.floods,
      icon: Waves,
      tone: "flood",
    },
    {
      label: "Fire incidents",
      value: hazards.fires,
      icon: Flame,
      tone: "fire",
    },
    {
      label: "Earthquake events",
      value: hazards.earthquakes,
      icon: TriangleAlert,
      tone: "earthquake",
    },
  ];
  return (
    <section
      id="dashboard-overview"
      className={`cdrrmo-section-anchor ${styles.dashboard}`}
      tabIndex={-1}
      aria-labelledby="dashboard-overview-title"
    >
      <div className={styles.heading}>
        <span className="eyebrow">CITY RESPONSE OVERVIEW</span>
        <h2 id="dashboard-overview-title">Dashboard</h2>
        <p>
          Monitor shelter capacity and open the tools you need to coordinate a
          response.
        </p>
      </div>
      <div className={styles.metrics}>
        {metrics.map(({ label, value, description, icon: Icon, tone }) => (
          <div className={styles.metric} key={label}>
            <span className={styles.metricIcon} data-tone={tone}>
              <Icon size={21} aria-hidden="true" />
            </span>
            <dl>
              <dt>{label}</dt>
              <dd>
                {centersUnavailable
                  ? "Unavailable"
                  : (value?.toLocaleString() ?? "Unavailable")}
              </dd>
            </dl>
            <p>{description}</p>
          </div>
        ))}
      </div>
      <div className={styles.panels}>
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <h3>Hazard reports</h3>
            <a href="#hazard-management">
              Open map <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
          <p>Reports currently loaded in the hazard workspace.</p>
          <dl className={styles.hazardList} aria-busy={hazardsLoading}>
            {hazardRows.map(({ label, value, icon: Icon, tone }) => (
              <div key={label}>
                <dt>
                  <span className={styles.hazardIcon} data-tone={tone}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  {label}
                </dt>
                <dd
                  className={
                    value === null ? styles.unavailableCount : undefined
                  }
                >
                  {hazardsLoading ? (
                    <SkeletonBlock className={styles.countSkeleton} />
                  ) : value === null ? (
                    "Unavailable"
                  ) : (
                    value.toLocaleString()
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {!hazardsLoading &&
            hazardRows.some(({ value }) => value === null) && (
              <p className={styles.unavailable} role="status">
                Some hazard information could not be loaded. Refresh the page to
                try again.
              </p>
            )}
        </div>
        <SharedLocationsPreview />
      </div>
    </section>
  );
}

export function CdrrmoDashboardSkeleton() {
  return (
    <div className={styles.dashboard}>
      <div className={`${styles.heading} staff-skeleton-copy`}>
        <SkeletonBlock className="staff-skeleton-eyebrow" />
        <SkeletonBlock className="staff-skeleton-title" />
        <SkeletonBlock className="staff-skeleton-line" />
      </div>
      <div className={styles.metrics}>
        {Array.from({ length: 4 }, (_, index) => (
          <div className={styles.metric} key={index}>
            <SkeletonBlock className={styles.metricIcon} />
            <div className="staff-skeleton-copy">
              <SkeletonBlock className="staff-skeleton-line" />
              <SkeletonBlock className="staff-skeleton-number" />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.panels}>
        {Array.from({ length: 2 }, (_, index) => (
          <div className={`${styles.panel} staff-skeleton-copy`} key={index}>
            <SkeletonBlock className="staff-skeleton-title" />
            <SkeletonBlock className="staff-skeleton-line" />
            {Array.from({ length: 3 }, (_, row) => (
              <SkeletonBlock className={styles.rowSkeleton} key={row} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
