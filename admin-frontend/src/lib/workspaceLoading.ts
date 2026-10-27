export type WorkspaceRole = "SUPER_ADMIN" | "BARANGAY_ADMIN";

const key = "evacurosa-workspace-loading";

// A per-tab visual hint only. API authorization always uses the verified session.
// No credentials, permissions, or profile data are stored here.
export function rememberWorkspaceRole(role: WorkspaceRole, userId: string) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ role, userId }));
  } catch {
    // Storage can be disabled; the neutral loading shell still works.
  }
}

export function readWorkspaceRole(userId?: string): WorkspaceRole | null {
  try {
    const hint = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (userId && hint?.userId !== userId) return null;
    return hint?.role === "SUPER_ADMIN" || hint?.role === "BARANGAY_ADMIN"
      ? hint.role
      : null;
  } catch {
    return null;
  }
}

export function clearWorkspaceRole() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Sign-out must work even when storage is disabled.
  }
}
