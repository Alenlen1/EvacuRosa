import type { SupabaseClient } from "@supabase/supabase-js";
import { validateLogin } from "./loginFeedback";

export type EmailValues = { email: string; password: string };
export type EmailErrors = Partial<Record<keyof EmailValues, string>>;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const EMAIL_CHANGE_PENDING_SECONDS = 60;

export function validateEmailChange(
  values: EmailValues,
  currentEmail: string,
): EmailErrors {
  const errors: EmailErrors = {};
  const invalid = validateLogin(values.email, values.password);
  if (invalid.email) errors.email = invalid.email;
  else if (normalizeEmail(values.email) === normalizeEmail(currentEmail))
    errors.email = "Enter a different email address.";
  if (invalid.password) errors.password = "Enter your current password.";
  return errors;
}

type Auth = Pick<
  SupabaseClient["auth"],
  "getUser" | "getSession" | "updateUser"
>;
type Verifier = Pick<
  SupabaseClient["auth"],
  "signInWithPassword" | "signOut" | "dispose"
>;

export type EmailChangeAccount = {
  userId: string;
  currentEmail: string;
  pendingEmail: string | null;
  confirmationSentAt?: number;
};

/** Read Auth's current address, not a possibly stale stored session. */
export async function getOwnEmailChange(
  auth: Pick<
    SupabaseClient["auth"],
    "getUser" | "getSession" | "refreshSession"
  >,
  expectedUserId?: string,
): Promise<EmailChangeAccount> {
  const { data, error } = await auth.getUser();
  if (error) throw error;
  const user = data.user;
  if (!user?.email) throw { code: "session_missing" };
  if (expectedUserId && user.id !== expectedUserId)
    throw { code: "session_changed" };
  const session = await auth.getSession();
  if (session.error) throw session.error;
  if (session.data.session?.user.id !== user.id)
    throw { code: "session_changed" };

  // Confirmation can happen in another browser. Refresh this same account's
  // stored session only after the server actually reports the changed email.
  if (
    normalizeEmail(session.data.session.user.email ?? "") !==
    normalizeEmail(user.email)
  ) {
    const refreshed = await auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    if (
      refreshed.data.user?.id !== user.id ||
      normalizeEmail(refreshed.data.user.email ?? "") !==
        normalizeEmail(user.email)
    )
      throw { code: "session_changed" };
  }
  const pending = user.new_email?.trim();
  const sentAt = Date.parse(user.email_change_sent_at ?? "");
  return {
    userId: user.id,
    currentEmail: user.email,
    pendingEmail:
      pending && normalizeEmail(pending) !== normalizeEmail(user.email)
        ? pending
        : null,
    ...(Number.isFinite(sentAt) ? { confirmationSentAt: sentAt } : {}),
  };
}

export async function resendOwnEmailChange(
  auth: Pick<
    SupabaseClient["auth"],
    "getUser" | "getSession" | "refreshSession" | "resend"
  >,
  expected: { userId: string; email: string },
  emailRedirectTo: string,
) {
  const account = await getOwnEmailChange(auth, expected.userId);
  if (normalizeEmail(account.currentEmail) === normalizeEmail(expected.email))
    return { account, confirmed: true };
  if (
    !account.pendingEmail ||
    normalizeEmail(account.pendingEmail) !== normalizeEmail(expected.email)
  )
    throw { code: "email_change_not_pending" };
  const { error } = await auth.resend({
    type: "email_change",
    // Auth finds the account by its CURRENT email, then sends to new_email.
    // Supplying the pending address can silently return 200 without mail.
    email: account.currentEmail,
    options: { emailRedirectTo },
  });
  if (error) throw error;
  return { account, confirmed: false };
}

export async function changeOwnEmail(
  auth: Auth,
  createVerifier: () => Verifier,
  values: EmailValues,
  emailRedirectTo: string,
) {
  const { data, error } = await auth.getUser();
  if (error) throw error;
  const user = data.user;
  if (!user?.email) throw { code: "session_missing" };
  if (Object.keys(validateEmailChange(values, user.email)).length)
    throw { code: "invalid_email_change" };
  const verifier = createVerifier();
  try {
    const verified = await verifier.signInWithPassword({
      email: user.email,
      password: values.password,
    });
    if (verified.error) throw verified.error;
    if (verified.data.user?.id !== user.id) throw { code: "session_changed" };
    const session = await auth.getSession();
    if (session.error) throw session.error;
    if (session.data.session?.user.id !== user.id)
      throw { code: "session_changed" };
    const updated = await auth.updateUser(
      { email: normalizeEmail(values.email) },
      { emailRedirectTo },
    );
    if (updated.error) throw updated.error;
    if (!updated.data.user || updated.data.user.id !== user.id)
      throw { code: "session_changed" };
    const sentAt = Date.parse(updated.data.user.email_change_sent_at ?? "");
    return {
      // Project Auth settings decide whether email confirmation is required.
      confirmed:
        normalizeEmail(updated.data.user.email ?? "") ===
        normalizeEmail(values.email),
      ...(Number.isFinite(sentAt) ? { confirmationSentAt: sentAt } : {}),
    };
  } finally {
    await verifier.signOut({ scope: "local" }).catch(() => undefined);
    await verifier.dispose().catch(() => undefined);
  }
}

export function emailChangeFailure(error: unknown): {
  message: string;
  field?: keyof EmailValues;
} {
  const { code, status } = (error ?? {}) as { code?: string; status?: number };
  if (code === "invalid_credentials")
    return {
      message: "Your current password is incorrect.",
      field: "password",
    };
  if (code === "email_exists" || code === "user_already_exists")
    return {
      message: "This email address cannot be used. Try a different address.",
      field: "email",
    };
  if (code === "email_address_invalid" || code === "invalid_email_change")
    return {
      message: "Enter a valid, different email address.",
      field: "email",
    };
  if (status === 429 || code?.includes("rate_limit"))
    return {
      message: "Too many attempts. Wait a few minutes, then try again.",
    };
  if (code === "email_change_not_pending")
    return {
      message:
        "This email change is no longer pending. Check confirmation again before requesting another email.",
    };
  if (code === "email_provider_disabled")
    return {
      message:
        "Email delivery is unavailable. Ask your system operator to check Supabase's email provider settings.",
    };
  if (
    code === "session_changed" ||
    code === "session_missing" ||
    status === 401 ||
    status === 403
  )
    return {
      message:
        "Your session changed or expired. Sign in again before changing your email.",
    };
  return {
    message:
      "Could not change your email. Check your connection and try again. If this continues, contact your system operator.",
  };
}
