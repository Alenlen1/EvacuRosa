import { supabase } from "@/lib/supabaseClient";
export async function adminApi(path: string, method = "GET", body?: unknown) {
  const { data } = await supabase!.auth.getSession();
  if (!data.session) throw new Error("Your session expired. Sign in again.");
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/admin${path}`,
    {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "The request could not be completed.");
  return result;
}
