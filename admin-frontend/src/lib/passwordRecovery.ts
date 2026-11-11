import type { SupabaseClient } from "@supabase/supabase-js";
import { passwordStrengthError } from "./changePassword";
import { normalizeEmail } from "./changeEmail";
import { validateLogin } from "./loginFeedback";

export const RECOVERY_RESEND_SECONDS = 60;
export type RecoveryField = "email" | "code" | "next" | "confirm";
export type RecoveryErrors = Partial<Record<RecoveryField, string>>;
type Auth = Pick<
  SupabaseClient["auth"],
  | "resetPasswordForEmail"
  | "verifyOtp"
  | "getUser"
  | "getSession"
  | "updateUser"
>;

export function validateRecoveryEmail(email: string) {
  return validateLogin(email, "unused").email;
}
export function validateRecoveryPassword(
  next: string,
  confirm: string,
): RecoveryErrors {
  const errors: RecoveryErrors = {};
  const weak = passwordStrengthError(next);
  if (weak) errors.next = weak;
  if (!confirm) errors.confirm = "Confirm your new password.";
  else if (confirm !== next) errors.confirm = "The new passwords do not match.";
  return errors;
}

export async function requestRecoveryCode(
  auth: Auth,
  email: string,
  redirectTo?: string,
) {
  if (validateRecoveryEmail(email)) throw { code: "invalid_recovery_email" };
  const result = await auth.resetPasswordForEmail(
    normalizeEmail(email),
    redirectTo ? { redirectTo } : undefined,
  );
  // Do not reveal whether an account exists or has a confirmed address.
  if (
    result.error &&
    !["user_not_found", "email_not_confirmed", "user_banned"].includes(
      result.error.code ?? "",
    )
  )
    throw result.error;
}

export async function verifyRecoveryCode(
  auth: Auth,
  email: string,
  code: string,
) {
  if (validateRecoveryEmail(email) || !/^\d{6}$/.test(code))
    throw { code: "invalid_recovery_code" };
  const result = await auth.verifyOtp({
    email: normalizeEmail(email),
    token: code,
    type: "recovery",
  });
  if (result.error) throw result.error;
  const { user, session } = result.data;
  if (
    !user ||
    !session ||
    session.user.id !== user.id ||
    normalizeEmail(user.email ?? "") !== normalizeEmail(email)
  )
    throw { code: "session_changed" };
  return user.id;
}

export async function resetRecoveredPassword(
  auth: Auth,
  userId: string,
  next: string,
  confirm: string,
) {
  if (Object.keys(validateRecoveryPassword(next, confirm)).length)
    throw { code: "weak_password" };
  if (!userId) throw { code: "session_missing" };
  const user = await auth.getUser();
  if (user.error) throw user.error;
  const session = await auth.getSession();
  if (session.error) throw session.error;
  if (user.data.user?.id !== userId || session.data.session?.user.id !== userId)
    throw { code: "session_changed" };
  const updated = await auth.updateUser({ password: next });
  if (updated.error) throw updated.error;
  if (updated.data.user?.id !== userId) throw { code: "session_changed" };
}

export function recoveryFailure(
  error: unknown,
  stage: "email" | "code" | "link" | "password",
): {
  message: string;
  field?: RecoveryField;
  restart?: boolean;
} {
  const { code, status } = (error ?? {}) as { code?: string; status?: number };
  if (status === 429 || code?.includes("rate_limit"))
    return {
      message: "Too many attempts. Wait a few minutes before trying again.",
    };
  if (stage === "link")
    return {
      message:
        "This reset link is invalid, expired, or could not be verified. Request a new recovery email below.",
      restart: true,
    };
  if (
    ["otp_expired", "otp_disabled", "invalid_recovery_code"].includes(
      code ?? "",
    ) ||
    (stage === "code" && status === 403)
  )
    return {
      message:
        "That code is invalid or expired. Check your latest email or request a new code.",
      field: "code",
    };
  if (
    [
      "session_changed",
      "session_missing",
      "session_not_found",
      "reauthentication_needed",
    ].includes(code ?? "") ||
    (stage === "password" && (status === 401 || status === 403))
  )
    return {
      message: "Your recovery session expired. Request a new code to continue.",
      restart: true,
    };
  if (code === "weak_password" || code === "same_password")
    return {
      message:
        code === "same_password"
          ? "Choose a password you have not used before."
          : "Choose a stronger password that meets all requirements.",
      field: "next",
    };
  if (stage === "email")
    return {
      message:
        "We could not send a recovery code. Try again later or contact your system operator.",
    };
  return {
    message:
      "Could not connect to the account service. Check your connection and try again.",
  };
}
