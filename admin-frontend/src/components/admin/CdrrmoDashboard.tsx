import {
  ArrowUpRight,
  CircleCheck,
  CircleMinus,
  Flame,
  House,
  LockKeyhole,
  RefreshCw,
  TriangleAlert,
  UsersRound,
  Waves,
} from "lucide-react";
import type { ManagedCenter } from "./CenterManager";
import { SkeletonBlock } from "./Skeleton";
import styles from "./CdrrmoDashboard.module.css";
import { SharedLocationsPreview } from "./SharedLocationsPreview";
import { getBarangayWorkspaceSummary } from "@/lib/barangayWorkspaceSummary";
import { getCdrrmoShelterStatusCounts } from "@/lib/cdrrmoShelterStatus";

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
  onRefreshHazards,
}: {
  centers: ManagedCenter[];
  centersUnavailable: boolean;
  hazards: DashboardHazards;
  hazardsLoading: boolean;
  onRefreshHazards: () => void;
}) {
  const shelterCounts = getCdrrmoShelterStatusCounts(centers);
  const totals = getBarangayWorkspaceSummary(centers);
  const metrics = [
    {
      label: "Available",
      value: shelterCounts.AVAILABLE,
      icon: CircleCheck,
      tone: "safe",
    },
    {
      label: "Nearly full",
      value: shelterCounts.NEARLY_FULL,
      icon: TriangleAlert,
      tone: "warning",
    },
    {
      label: "Full",
      value: shelterCounts.FULL,
      icon: CircleMinus,
      tone: "danger",
    },
    {
      label: "Closed",
      value: shelterCounts.CLOSED,
      icon: LockKeyhole,
      tone: "neutral",
    },
  ];
  const capacityMetrics = [
    { label: "Registered centers", value: centers.length, icon: House },
    { label: "Reported occupants", value: totals.occupancy, icon: UsersRound },
    { label: "Available spaces", value: totals.remainingSpaces, icon: House },
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
      label: "Earthquake road impacts",
      value: hazards.earthquakes,
      icon: TriangleAlert,
      tone: "earthquake",
    },
  ];
  const hazardTotal = hazardRows.every(({ value }) => value !== null)
    ? hazardRows.reduce((total, { value }) => total + (value ?? 0), 0)
    : null;
  return (
    <section
      id="dashboard-overview"
      className={`cdrrmo-section-anchor ${styles.dashboard}`}
      tabIndex={-1}
      aria-labelledby="dashboard-overview-title"
    >
      <div className={styles.heading}>
        <span className="eyebrow">CITY RESPONSE OVERVIEW</span>
        <h2 id="dashboard-overview-title">Overview</h2>
        <p>
          Shelter availability, active hazards and assistance requests across
          Santa Rosa.
        </p>
      </div>
      <section className={styles.shelters} aria-label="Shelter availability">
        <div className={styles.metrics}>
          {metrics.map(({ label, value, icon: Icon, tone }) => (
            <div className={styles.metric} key={label}>
              <span className={styles.metricIcon} data-tone={tone}>
                <Icon size={21} aria-hidden="true" />
              </span>
              <dl>
                <dt>{label}</dt>
                <dd data-unavailable={centersUnavailable || undefined}>
                  {centersUnavailable
                    ? "Unavailable"
                    : (value?.toLocaleString() ?? "Unavailable")}
                </dd>
              </dl>
            </div>
          ))}
        </div>
        <dl
          className={styles.capacitySummary}
          aria-label="City shelter capacity"
        >
          {capacityMetrics.map(({ label, value, icon: Icon }) => (
            <div key={label}>
              <dt>
                <Icon size={14} aria-hidden="true" />
                {label}
              </dt>
              <dd>
                {centersUnavailable
                  ? "Unavailable"
                  : (value?.toLocaleString() ?? "Unavailable")}
              </dd>
            </div>
          ))}
        </dl>
        <p className={styles.capacityNote}>
          Spaces at centers accepting evacuees; counts reflect saved barangay
          updates.
        </p>
      </section>
      <div className={styles.panels}>
        <section
          className={styles.panel}
          aria-labelledby="active-hazards-title"
        >
          <div className={styles.panelHeading}>
            <h3 id="active-hazards-title">Active hazards</h3>
            <div className={styles.panelControls}>
              <button
                type="button"
                className={styles.refresh}
                aria-label="Refresh hazard overview"
                disabled={hazardsLoading}
                onClick={onRefreshHazards}
              >
                <RefreshCw size={14} aria-hidden="true" />
              </button>
              <a href="#hazard-management">
                Open map <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          </div>
          <p>Active flood/fire reports and verified earthquake road impacts.</p>
          <dl className={styles.hazardTotal} aria-busy={hazardsLoading}>
            <dt>Active hazard records</dt>
            <dd data-unavailable={hazardTotal === null || undefined}>
              {hazardsLoading ? (
                <SkeletonBlock className={styles.countSkeleton} />
              ) : hazardTotal === null ? (
                "Unavailable"
              ) : (
                hazardTotal.toLocaleString()
              )}
            </dd>
          </dl>
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
                Some hazard information could not be loaded. Refresh the
                overview to try again.
              </p>
            )}
        </section>
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
      <div className={styles.shelters}>
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
        <SkeletonBlock className={styles.capacitySkeleton} />
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
