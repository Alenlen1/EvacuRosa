import Link from "next/link";
import { Brand } from "@/components/ui/Brand";
import type { WorkspaceRole } from "@/lib/workspaceLoading";
import { SkeletonBlock } from "./Skeleton";

export function StaffHeader({
  role = null,
  directory = false,
  loading = false,
  busy = false,
  onSignOut,
}: {
  role?: WorkspaceRole | null;
  directory?: boolean;
  loading?: boolean;
  busy?: boolean;
  onSignOut?: () => void;
}) {
  const hasPublicMap = Boolean(process.env.NEXT_PUBLIC_PUBLIC_APP_URL);
  return (
    <header
      className="app-header staff-workspace-header"
      data-workspace={role === "SUPER_ADMIN" ? "cdrrmo" : "barangay"}
      aria-busy={loading}
    >
      <div className="staff-header-content">
        {loading ? (
          <>
            <span className="staff-skeleton-label" role="status">
              Loading workspace header...
            </span>
            <span className="staff-header-brand-skeleton" aria-hidden="true">
              <SkeletonBlock className="staff-skeleton-brand-mark" />
              <span>
                <SkeletonBlock className="staff-skeleton-brand-name" />
                <SkeletonBlock className="staff-skeleton-brand-caption" />
              </span>
            </span>
          </>
        ) : (
          <Link
            href={directory ? "/admin/barangays" : "/admin/dashboard"}
            aria-label="EvacuRosa administration"
          >
            <Brand />
          </Link>
        )}
        <div className="staff-header-actions">
          {!directory &&
            (loading ? (
              <SkeletonBlock className="staff-skeleton-header-city" />
            ) : (
              <span className="city-label">Santa Rosa, Laguna</span>
            ))}
          {!directory &&
            role === "BARANGAY_ADMIN" &&
            (loading ? (
              <SkeletonBlock className="staff-skeleton-header-home" />
            ) : (
              <Link
                className="secondary-button staff-header-home"
                href="/admin/barangays"
              >
                Barangay home
              </Link>
            ))}
          {!directory &&
            hasPublicMap &&
            (loading ? (
              <SkeletonBlock className="staff-skeleton-header-public" />
            ) : (
              <a
                href={process.env.NEXT_PUBLIC_PUBLIC_APP_URL}
                className="admin-link"
              >
                Public map
              </a>
            ))}
          {loading ? (
            <SkeletonBlock className="staff-skeleton-header-action" />
          ) : (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={onSignOut}
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
