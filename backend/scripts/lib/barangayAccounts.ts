import { SANTA_ROSA_BARANGAYS } from "../../src/geography/barangays";

export type AccountEntry = { barangay: string; email: string };
export type AccountUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
};
export type AccountProfile = {
  id: string;
  role: string;
  barangay_id: string | null;
};
export type AccountPlan = AccountEntry & {
  barangayId: string;
  userId?: string;
  action: "create" | "migrate" | "keep";
};

export function validateAccountList(value: unknown): AccountEntry[] {
  if (!Array.isArray(value) || value.length !== SANTA_ROSA_BARANGAYS.length)
    throw Error(
      "Provide exactly one email address for each of the 18 barangays.",
    );
  const names = new Set<string>();
  const emails = new Set<string>();
  return value.map((entry) => {
    if (
      !entry ||
      typeof entry.barangay !== "string" ||
      !SANTA_ROSA_BARANGAYS.some((name) => name === entry.barangay) ||
      names.has(entry.barangay)
    )
      throw Error("Use each barangay name from the template exactly once.");
    names.add(entry.barangay);
    const email =
      typeof entry.email === "string" ? entry.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith(".invalid"))
      throw Error(`Enter a usable email address for ${entry.barangay}.`);
    if (emails.has(email))
      throw Error("Each barangay must have a different email address.");
    emails.add(email);
    return { barangay: entry.barangay, email };
  });
}

/** Plan the entire batch before making any changes. Never claim an unrelated user. */
export function planBarangayAccounts(
  entries: AccountEntry[],
  barangays: { id: string; name: string }[],
  profiles: AccountProfile[],
  users: AccountUser[],
  mappings: { barangay_id: string; user_id: string }[],
): AccountPlan[] {
  return validateAccountList(entries).map((entry) => {
    const matches = barangays.filter((row) => row.name === entry.barangay);
    if (matches.length !== 1)
      throw Error(`Missing or ambiguous barangay: ${entry.barangay}.`);
    const barangayId = matches[0].id;
    const assigned = profiles.filter(
      (row) => row.role === "BARANGAY_ADMIN" && row.barangay_id === barangayId,
    );
    if (assigned.length > 1)
      throw Error(
        `Multiple assigned accounts for ${entry.barangay}; resolve them before proceeding.`,
      );
    const mapping = mappings.find((row) => row.barangay_id === barangayId);
    const pending = users.filter(
      (user) =>
        user.app_metadata?.barangay_password_login === true &&
        user.app_metadata?.barangay_id === barangayId,
    );
    if (pending.length > 1)
      throw Error(
        `Multiple provisioned identities for ${entry.barangay}; review the private checkpoints.`,
      );
    const userId = mapping?.user_id ?? assigned[0]?.id ?? pending[0]?.id;
    if (mapping && assigned[0]?.id !== mapping.user_id)
      throw Error(
        `Account mapping/profile mismatch for ${entry.barangay}. No accounts changed.`,
      );
    const identity = users.find((user) => user.id === userId);
    if (userId && !identity)
      throw Error(`Auth identity missing for ${entry.barangay}.`);
    const identityProfile = profiles.find((row) => row.id === userId);
    if (
      identityProfile &&
      (identityProfile.role !== "BARANGAY_ADMIN" ||
        identityProfile.barangay_id !== barangayId)
    )
      throw Error(
        `Refusing to reassign another role or barangay account to ${entry.barangay}.`,
      );
    const owner = users.find(
      (user) => user.email?.toLowerCase() === entry.email,
    );
    if (owner && owner.id !== userId)
      throw Error(
        `The email for ${entry.barangay} belongs to another account. No accounts changed.`,
      );
    const ready =
      assigned[0]?.id === userId &&
      identity?.email?.toLowerCase() === entry.email &&
      identity.app_metadata?.barangay_password_login === true;
    return {
      ...entry,
      barangayId,
      userId,
      action: !userId ? "create" : ready ? "keep" : "migrate",
    };
  });
}
