import { publicSans } from "@/app/fonts/publicSans";
import type { WorkspaceRole } from "@/lib/workspaceLoading";
import { StaffHeader } from "./StaffHeader";
import { SkeletonBlock, SkeletonRegion } from "./Skeleton";
import centerStyles from "./CenterManager.module.css";
import workspaceStyles from "./BarangayWorkspaceCenter.module.css";

export { SkeletonBlock, SkeletonRegion } from "./Skeleton";

export function MapSkeleton({
  label = "Loading map...",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <SkeletonRegion label={label} className={`staff-map-skeleton ${className}`}>
      <SkeletonBlock className="staff-skeleton-map-surface" />
      <span className="staff-skeleton-map-controls">
        <SkeletonBlock />
        <SkeletonBlock />
      </span>
      <span className="staff-skeleton-map-caption">
        <SkeletonBlock className="staff-skeleton-line" />
      </span>
    </SkeletonRegion>
  );
}

function CardPlaceholders({ count = 3 }: { count?: number }) {
  return Array.from({ length: count }, (_, index) => (
    <div className="staff-skeleton-card" key={index}>
      <SkeletonBlock className="staff-skeleton-avatar" />
      <SkeletonBlock className="staff-skeleton-title" />
      <SkeletonBlock className="staff-skeleton-line" />
      <SkeletonBlock className="staff-skeleton-line staff-skeleton-short" />
    </div>
  ));
}

export function RecordsSkeleton({
  label = "Loading records...",
}: {
  label?: string;
}) {
  return (
    <SkeletonRegion label={label} className="staff-records-skeleton">
      <CardPlaceholders />
    </SkeletonRegion>
  );
}

export function BarangayDirectorySkeleton() {
  return (
    <SkeletonRegion
      label="Loading barangays..."
      className="staff-directory-skeleton"
    >
      <section className="barangay-city-summary">
        <SkeletonBlock className="staff-skeleton-line staff-skeleton-short" />
        <div className="barangay-summary-metrics staff-skeleton-city-metrics">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="barangay-summary-metric" key={index}>
              <SkeletonBlock className="staff-skeleton-small-icon" />
              <SkeletonBlock className="staff-skeleton-line" />
              <SkeletonBlock className="staff-skeleton-metric-value" />
            </div>
          ))}
        </div>
      </section>
      <section className="barangay-finder">
        <div className="barangay-search">
          <div className="staff-skeleton-copy">
            <SkeletonBlock className="staff-skeleton-line" />
            <SkeletonBlock className="staff-skeleton-line staff-skeleton-short" />
          </div>
          <div className="barangay-search-row">
            <SkeletonBlock className="staff-skeleton-input" />
            <SkeletonBlock className="staff-skeleton-header-home" />
          </div>
        </div>
        <div className="barangay-overview">
          <div className="barangay-overview-heading">
            <div className="staff-skeleton-copy">
              <SkeletonBlock className="staff-skeleton-title" />
              <SkeletonBlock className="staff-skeleton-line" />
            </div>
            <SkeletonBlock className="staff-skeleton-header-home" />
          </div>
          <SkeletonBlock className="staff-skeleton-line staff-skeleton-map-note" />
          <SkeletonBlock className="staff-skeleton-directory-map" />
        </div>
      </section>
      <div className="barangay-access-grid">
        <CardPlaceholders count={8} />
      </div>
    </SkeletonRegion>
  );
}

function WorkspaceHeadingSkeleton({ role }: { role: WorkspaceRole | null }) {
  return (
    <div className="admin-heading staff-skeleton-workspace-heading">
      {role === "BARANGAY_ADMIN" && (
        <SkeletonBlock className="barangay-workspace-seal" />
      )}
      <div className="staff-skeleton-copy">
        <SkeletonBlock className="staff-skeleton-eyebrow" />
        <SkeletonBlock className="staff-skeleton-workspace-title" />
        <SkeletonBlock className="staff-skeleton-line" />
      </div>
      {role === "SUPER_ADMIN" && (
        <SkeletonBlock className="staff-skeleton-header-home" />
      )}
    </div>
  );
}

function CenterManagementSkeleton() {
  return (
    <section className={`center-management ${centerStyles.manager}`}>
      <div className={centerStyles.sectionHeading}>
        <div
          className={`${centerStyles.headingCopy} staff-skeleton-section-copy`}
        >
          <SkeletonBlock className={centerStyles.sectionIcon} />
          <div className="staff-skeleton-copy">
            <SkeletonBlock className="staff-skeleton-eyebrow" />
            <SkeletonBlock className="staff-skeleton-title" />
            <SkeletonBlock className="staff-skeleton-line" />
          </div>
        </div>
        <SkeletonBlock className="staff-skeleton-register-button" />
      </div>
      <div className={centerStyles.stats}>
        {Array.from({ length: 4 }, (_, index) => (
          <div className={centerStyles.stat} key={index}>
            <SkeletonBlock className={centerStyles.statIcon} />
            <div className="staff-skeleton-copy">
              <SkeletonBlock className="staff-skeleton-line" />
              <SkeletonBlock className="staff-skeleton-metric-value" />
            </div>
          </div>
        ))}
      </div>
      <div
        className={`${centerStyles.directoryToolbar} staff-skeleton-center-directory`}
      >
        <SkeletonBlock className="staff-skeleton-title" />
        <SkeletonBlock className="staff-skeleton-input" />
      </div>
      <div className={centerStyles.centerGrid}>
        {Array.from({ length: 2 }, (_, index) => (
          <div
            className={`${centerStyles.centerCard} staff-skeleton-center-record`}
            key={index}
          >
            <div className={centerStyles.cardHeading}>
              <SkeletonBlock className={centerStyles.cardIcon} />
              <div className="staff-skeleton-copy">
                <SkeletonBlock className="staff-skeleton-line staff-skeleton-short" />
                <SkeletonBlock className="staff-skeleton-title" />
              </div>
            </div>
            <SkeletonBlock className="staff-skeleton-line" />
            <SkeletonBlock className="staff-skeleton-input" />
            <SkeletonBlock className="staff-skeleton-line staff-skeleton-short" />
          </div>
        ))}
      </div>
    </section>
  );
}

function BarangayWorkspaceSkeleton() {
  return (
    <>
      <div className="barangay-workspace-summary">
        <div className="barangay-workspace-metrics">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              className="barangay-workspace-metric staff-skeleton-copy"
              key={index}
            >
              <SkeletonBlock className="staff-skeleton-line" />
              <SkeletonBlock className="staff-skeleton-number" />
              <SkeletonBlock className="staff-skeleton-line" />
            </div>
          ))}
        </div>
      </div>
      <div className="barangay-center-management">
        <div className="admin-center-cards">
          {Array.from({ length: 2 }, (_, index) => (
            <div
              className={`barangay-center-card ${workspaceStyles.card}`}
              key={index}
            >
              <div className={workspaceStyles.header}>
                <SkeletonBlock className={workspaceStyles.shelterIcon} />
                <div className="staff-skeleton-copy">
                  <SkeletonBlock className="staff-skeleton-eyebrow" />
                  <SkeletonBlock className="staff-skeleton-title" />
                  <SkeletonBlock className="staff-skeleton-line" />
                </div>
              </div>
              <div
                className={`${workspaceStyles.occupancy} staff-skeleton-copy`}
              >
                <SkeletonBlock className="staff-skeleton-line staff-skeleton-short" />
                <SkeletonBlock className="staff-skeleton-number" />
                <SkeletonBlock className="staff-skeleton-line" />
                <SkeletonBlock className="staff-skeleton-input" />
                <SkeletonBlock className="staff-skeleton-input" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function DashboardSkeleton({
  role = null,
}: {
  role?: WorkspaceRole | null;
}) {
  const workspaceClass =
    role === "SUPER_ADMIN"
      ? "cdrrmo-workspace"
      : role === "BARANGAY_ADMIN"
        ? "barangay-workspace"
        : "staff-loading-page";
  const contentClass =
    role === "SUPER_ADMIN" ? "cdrrmo-content" : "barangay-workspace-content";
  return (
    <main className={`admin-app ${workspaceClass} ${publicSans.className}`}>
      <StaffHeader role={role} loading />
      <SkeletonRegion
        label={
          role === "SUPER_ADMIN"
            ? "Loading CDRRMO workspace..."
            : role === "BARANGAY_ADMIN"
              ? "Loading barangay workspace..."
              : "Loading your workspace..."
        }
        className={`${contentClass} staff-dashboard-skeleton`}
      >
        <WorkspaceHeadingSkeleton role={role} />
        {role === "SUPER_ADMIN" ? (
          <>
            <div className="staff-section-nav staff-skeleton-navigation">
              {Array.from({ length: 3 }, (_, index) => (
                <SkeletonBlock key={index} />
              ))}
            </div>
            <CenterManagementSkeleton />
          </>
        ) : role === "BARANGAY_ADMIN" ? (
          <BarangayWorkspaceSkeleton />
        ) : (
          <div className="staff-skeleton-card staff-skeleton-neutral-panel">
            <SkeletonBlock className="staff-skeleton-input" />
          </div>
        )}
      </SkeletonRegion>
    </main>
  );
}

export function BarangayPageSkeleton() {
  return (
    <main
      className={`staff-login barangay-access-page ${publicSans.className}`}
    >
      <StaffHeader role="BARANGAY_ADMIN" directory loading />
      <div className="staff-login-content">
        <SkeletonRegion label="Loading barangay administration...">
          <div className="staff-login-title staff-skeleton-directory-heading">
            <div className="staff-skeleton-copy">
              <SkeletonBlock className="staff-skeleton-eyebrow" />
              <SkeletonBlock className="staff-skeleton-workspace-title" />
              <SkeletonBlock className="staff-skeleton-line" />
            </div>
          </div>
        </SkeletonRegion>
        <BarangayDirectorySkeleton />
      </div>
    </main>
  );
}
