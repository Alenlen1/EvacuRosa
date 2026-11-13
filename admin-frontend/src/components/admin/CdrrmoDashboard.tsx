import {
  ArrowRight,
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
  const capacityMetrics = [
    {
      label: "Available spaces",
      value: totals.remainingSpaces,
      icon: House,
      detail: "At centers accepting evacuees",
      featured: true,
    },
    {
      label: "Reported occupants",
      value: totals.occupancy,
      icon: UsersRound,
      detail: "Latest saved barangay counts",
      featured: false,
    },
    {
      label: "Registered centers",
      value: centers.length,
      icon: House,
      detail: "Across all barangays",
      featured: false,
    },
  ];
  const statuses = [
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
  const hazardRows = [
    {
      label: "Flood reports",
      detail: "Reported flood conditions",
      value: hazards.floods,
      icon: Waves,
      tone: "flood",
    },
    {
      label: "Fire incidents",
      detail: "Reported fire locations",
      value: hazards.fires,
      icon: Flame,
      tone: "fire",
    },
    {
      label: "Earthquake reports",
      detail: "Verified debris and road impacts",
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
        <div>
          <h2 id="dashboard-overview-title">City response overview</h2>
          <p>
            Monitor shelter availability and requests that need your attention.
          </p>
        </div>
        <a className={styles.textLink} href="#evacuation-centers">
          Manage centers <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
      <section
        className={styles.capacitySummary}
        aria-label="City shelter capacity"
      >
        {capacityMetrics.map(
          ({ label, value, icon: Icon, detail, featured }) => (
            <div
              className={styles.capacityCard}
              data-featured={featured || undefined}
              key={label}
            >
              <dl>
                <dt>
                  <span>{label}</span>
                  <Icon size={20} aria-hidden="true" />
                </dt>
                <dd
                  data-unavailable={
                    centersUnavailable || value === null || undefined
                  }
                >
                  {centersUnavailable
                    ? "Unavailable"
                    : (value?.toLocaleString() ?? "Unavailable")}
                </dd>
              </dl>
              <p>{detail}</p>
            </div>
          ),
        )}
      </section>
      <section
        className={styles.availability}
        aria-labelledby="center-availability-title"
      >
        <div className={styles.availabilityHeading}>
          <h3 id="center-availability-title">Center availability</h3>
          <p>Based on saved center status</p>
        </div>
        <dl className={styles.statuses}>
          {statuses.map(({ label, value, icon: Icon, tone }) => (
            <div className={styles.status} data-tone={tone} key={label}>
              <dt>
                <Icon size={16} aria-hidden="true" />
                {label}
              </dt>
              <dd data-unavailable={centersUnavailable || undefined}>
                {centersUnavailable ? "Unavailable" : value.toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <div className={styles.panels}>
        <SharedLocationsPreview />
        <section
          className={`${styles.panel} ${styles.hazardPanel}`}
          aria-labelledby="active-hazards-title"
        >
          <div className={styles.panelHeading}>
            <div>
              <h3 id="active-hazards-title">Active hazards</h3>
              <p>Current reports on the public map</p>
            </div>
            <button
              type="button"
              className={styles.refresh}
              aria-label="Refresh hazard overview"
              disabled={hazardsLoading}
              onClick={onRefreshHazards}
            >
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>
          <dl className={styles.hazardList} aria-busy={hazardsLoading}>
            {hazardRows.map(({ label, detail, value, icon: Icon, tone }) => (
              <div key={label}>
                <dt>
                  <span className={styles.hazardIcon} data-tone={tone}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </span>
                </dt>
                <dd data-unavailable={value === null || undefined}>
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
          <div className={styles.panelFooter}>
            <span role="status">
              {hazardsLoading
                ? "Updating reports…"
                : hazardTotal === null
                  ? "Some counts are unavailable"
                  : `${hazardTotal.toLocaleString()} active ${hazardTotal === 1 ? "report" : "reports"}`}
            </span>
            <a className={styles.textLink} href="#hazard-management">
              Manage hazards <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>
    </section>
  );
}

export function CdrrmoDashboardSkeleton() {
  return (
    <div className={styles.dashboard}>
      <div className={styles.heading}>
        <div className="staff-skeleton-copy">
          <SkeletonBlock className="staff-skeleton-title" />
          <SkeletonBlock className="staff-skeleton-line" />
        </div>
      </div>
      <div className={styles.capacitySummary}>
        {Array.from({ length: 3 }, (_, index) => (
          <div
            className={`${styles.capacityCard} staff-skeleton-copy`}
            key={index}
          >
            <SkeletonBlock className="staff-skeleton-line" />
            <SkeletonBlock className="staff-skeleton-number" />
            <SkeletonBlock className="staff-skeleton-line staff-skeleton-short" />
          </div>
        ))}
      </div>
      <div className={styles.availability}>
        <SkeletonBlock className="staff-skeleton-line" />
        <div className={styles.statuses}>
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBlock className={styles.statusSkeleton} key={index} />
          ))}
        </div>
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
