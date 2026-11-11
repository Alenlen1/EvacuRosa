import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import type { WorkspaceRole } from "@/lib/workspaceLoading";
import { SkeletonBlock } from "./Skeleton";
import { SignOutButton } from "./SignOutButton";
import { StaffAccountMenu } from "./StaffAccountMenu";

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
  onSignOut?: () => void | Promise<void>;
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
          <Link href="/admin/dashboard" aria-label="EvacuRosa administration">
            <Brand />
          </Link>
        )}
        <div className="staff-header-actions">
          {hasPublicMap &&
            (loading ? (
              <SkeletonBlock className="staff-skeleton-header-public" />
            ) : (
              <a
                href={process.env.NEXT_PUBLIC_PUBLIC_APP_URL}
                className="staff-header-public-map"
              >
                Public map
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            ))}
          {loading ? (
            <SkeletonBlock className="staff-skeleton-header-action" />
          ) : role === "BARANGAY_ADMIN" || role === "SUPER_ADMIN" ? (
            <StaffAccountMenu disabled={busy} onSignOut={onSignOut} />
          ) : (
            <SignOutButton
              className="staff-header-sign-out"
              disabled={busy}
              onSignOut={onSignOut}
            />
          )}
        </div>
      </div>
    </header>
  );
}
