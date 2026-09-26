import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/environment";

let serviceClient: SupabaseClient | null = null;

/** Service-role client — bypasses RLS entirely. Public-data reads and the
 * validated anonymous assistance intake only. Role-gated reads/writes must
 * use the caller's userSupabase client instead. */
export function getSupabase(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return null;
  }
  if (!serviceClient) {
    serviceClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return serviceClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey && env.supabaseServiceRoleKey);
}
