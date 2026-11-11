import { createClient } from "@supabase/supabase-js";
import { detectWorkspaceSessionInUrl } from "./passwordRecoveryLink";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Keep normal staff/email-confirmation sessions persistent. Reset-link sessions
// are verified separately by PasswordRecoveryDialog without replacing these.
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { detectSessionInUrl: detectWorkspaceSessionInUrl },
      })
    : null;
