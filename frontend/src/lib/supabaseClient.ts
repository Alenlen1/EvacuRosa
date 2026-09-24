import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** null until a Supabase project's URL and anon key are set — every
 * caller must handle that case rather than assume auth is available. */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
