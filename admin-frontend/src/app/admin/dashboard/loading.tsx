"use client";

import { DashboardSkeleton } from "@/components/admin/LoadingSkeleton";
import { useWorkspaceLoadingRole } from "@/hooks/useWorkspaceLoadingRole";

export default function Loading() {
  const [role] = useWorkspaceLoadingRole();
  return <DashboardSkeleton role={role} />;
}
