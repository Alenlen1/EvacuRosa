import type { SupabaseClient } from "@supabase/supabase-js";

export type PasswordField = "current" | "next" | "confirm";
export type PasswordValues = Record<PasswordField, string>;
export type PasswordErrors = Partial<Record<PasswordField, string>>;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_REQUIREMENTS =
  "At least 10 characters, with an uppercase letter, a lowercase letter, a number and a special symbol.";
// Match the symbols supported by Supabase's password-strength settings.
const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\":\\|<>?,./`~";

export function validatePasswordChange(values: PasswordValues): PasswordErrors {
  const errors: PasswordErrors = {};
  if (!values.current) errors.current = "Enter your current password.";
  if (values.next.length < PASSWORD_MIN_LENGTH)
    errors.next = `Use at least ${PASSWORD_MIN_LENGTH} characters for your new password.`;
  else if (values.next === values.current)
    errors.next = "Choose a password different from your current password.";
  else {
    const missing = [
      !/[A-Z]/.test(values.next) && "an uppercase letter",
      !/[a-z]/.test(values.next) && "a lowercase letter",
      !/[0-9]/.test(values.next) && "a number",
      !Array.from(values.next).some((character) =>
        PASSWORD_SYMBOLS.includes(character),
      ) && "a special symbol",
    ].filter(Boolean);
    if (missing.length)
      errors.next = `Your new password needs ${missing.join(", ")}.`;
  }
  if (!values.confirm) errors.confirm = "Confirm your new password.";
  else if (values.confirm !== values.next)
    errors.confirm = "The new passwords do not match.";
  return errors;
}

export function passwordChangeFailure(error: unknown): {
  message: string;
  field?: PasswordField;
} {
  const { code, status } = (error ?? {}) as { code?: string; status?: number };
  if (code === "invalid_credentials" || code === "current_password_invalid")
    return { message: "Your current password is incorrect.", field: "current" };
  if (code === "same_password")
    return { message: "Choose a different new password.", field: "next" };
  if (code === "weak_password")
    return {
      message:
        "Choose a stronger password with upper and lowercase letters, a number and a symbol.",
      field: "next",
    };
  if (
    status === 429 ||
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit"
  )
    return {
      message: "Too many attempts. Wait a few minutes before trying again.",
    };
  if (
    code === "reauthentication_needed" ||
    code === "reauthentication_not_valid"
  )
    return {
      message: "Sign out and sign in again, then retry changing your password.",
    };
  if (
    status === 401 ||
    status === 403 ||
    code === "session_not_found" ||
    code === "session_changed" ||
    code === "session_missing"
  )
    return {
      message:
        "Your session has changed or expired. Sign in again before changing your password.",
    };
  if (
    error instanceof TypeError ||
    status === 0 ||
    code === "unexpected_failure" ||
    (status && status >= 500)
  )
    return {
      message:
        "Could not reach the account service. Check your connection and try again.",
    };
  return { message: "Could not change your password. Please try again." };
}

type Auth = Pick<
  SupabaseClient["auth"],
  "getUser" | "getSession" | "updateUser"
>;
type Verifier = Pick<
  SupabaseClient["auth"],
  "signInWithPassword" | "signOut" | "dispose"
>;

/** Verify without replacing the workspace session or persisting a second login. */
export async function changeOwnPassword(
  auth: Auth,
  createVerifier: () => Verifier,
  values: PasswordValues,
): Promise<void> {
  if (Object.keys(validatePasswordChange(values)).length)
    throw new Error("Invalid password fields.");
  const { data, error } = await auth.getUser();
  if (error) throw error;
  const user = data.user;
  if (!user?.email) throw { code: "session_missing" };

  const verifier = createVerifier();
  try {
    const verified = await verifier.signInWithPassword({
      email: user.email,
      password: values.current,
    });
    if (verified.error) throw verified.error;
    if (verified.data.user?.id !== user.id) throw { code: "session_changed" };
    // Another tab might have signed in as a different account during verification.
    const session = await auth.getSession();
    if (session.error) throw session.error;
    if (session.data.session?.user.id !== user.id)
      throw { code: "session_changed" };
    const updated = await auth.updateUser({
      current_password: values.current,
      password: values.next,
    });
    if (updated.error) throw updated.error;
    if (!updated.data.user) throw { code: "session_missing" };
  } finally {
    // Local scope revokes only this temporary session, never other staff logins.
    // A cleanup failure must not turn a successful password change into a retry.
    await verifier.signOut({ scope: "local" }).catch(() => undefined);
    await verifier.dispose().catch(() => undefined);
  }
}
