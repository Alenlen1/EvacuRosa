/** Navigation convenience only; the API and RLS enforce the actual permissions. */
export function staffAccessError(
  profile: {
    role?: string;
    barangay_id?: string | null;
  } | null,
): string | null {
  if (profile?.role === "SUPER_ADMIN") return null;
  if (profile?.role !== "BARANGAY_ADMIN")
    return "Your account does not have admin access. Contact your designated system operator.";
  if (!profile.barangay_id)
    return "Your account needs a barangay assignment. Contact your designated system operator.";
  return null;
}
