import type { ReactNode } from "react";

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <span className={`staff-skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonRegion({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className} role="status" aria-busy="true">
      <span className="staff-skeleton-label">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}
