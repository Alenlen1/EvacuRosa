"use client";

import { createClient } from "@supabase/supabase-js";

/** Recovery and credential checks must never replace the workspace session. */
export function createAccountClient(
  purpose: "recovery" | "email-verification",
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Account service is unavailable.");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `evacurosa-${purpose}-${crypto.randomUUID()}`,
    },
  });
}

export async function closeAccountClient(
  client: ReturnType<typeof createAccountClient>,
) {
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    // This isolated session has no persistent browser storage to clear.
  } finally {
    await client.auth.dispose().catch(() => undefined);
  }
}
