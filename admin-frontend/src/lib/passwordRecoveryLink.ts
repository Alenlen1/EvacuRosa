import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmail } from "./changeEmail";

export type RecoveryLink =
  | { tokens: { access_token: string; refresh_token: string } }
  | { invalid: true };

export function isPasswordRecoveryUrl(url: URL) {
  return (
    url.searchParams.get("recovery") === "1" ||
    new URLSearchParams(url.hash.slice(1)).get("type") === "recovery"
  );
}

/** Recovery credentials belong to an isolated client, never the workspace. */
export function detectWorkspaceSessionInUrl(
  url: URL,
  params: Partial<Record<string, string>>,
) {
  return (
    !isPasswordRecoveryUrl(url) &&
    Boolean(
      params.access_token ||
        params.error ||
        params.error_description ||
        params.error_code,
    )
  );
}

export function takePasswordRecoveryLink(
  browser: Pick<Window, "location" | "history">,
): RecoveryLink | null {
  const url = new URL(browser.location.href);
  if (!isPasswordRecoveryUrl(url)) return null;
  const params = new URLSearchParams(url.hash.slice(1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  // Remove bearer credentials and provider errors before rendering the form.
  url.hash = "";
  url.searchParams.delete("recovery");
  browser.history.replaceState(
    browser.history.state,
    "",
    url.pathname + url.search,
  );
  if (
    params.get("type") !== "recovery" ||
    params.has("error") ||
    params.has("error_code") ||
    params.has("error_description") ||
    params.get("token_type") !== "bearer" ||
    !access_token ||
    !refresh_token
  )
    return { invalid: true };
  return { tokens: { access_token, refresh_token } };
}

export async function verifyPasswordRecoveryLink(
  auth: Pick<SupabaseClient["auth"], "setSession" | "getUser">,
  link: RecoveryLink,
) {
  if (!("tokens" in link)) throw { code: "invalid_recovery_link" };
  const result = await auth.setSession(link.tokens);
  if (result.error) throw result.error;
  const session = result.data.session;
  const verified = await auth.getUser();
  if (verified.error) throw verified.error;
  const user = verified.data.user;
  if (!session || !user?.email || session.user.id !== user.id)
    throw { code: "session_changed" };
  return { userId: user.id, email: normalizeEmail(user.email) };
}
