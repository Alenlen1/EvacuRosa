"use client";

import { useEffect, useState } from "react";
import { readWorkspaceRole, type WorkspaceRole } from "@/lib/workspaceLoading";

export function useWorkspaceLoadingRole() {
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  // Start with the same neutral shell on the server and client.
  useEffect(() => setRole(readWorkspaceRole()), []);
  return [role, setRole] as const;
}
