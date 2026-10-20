import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "../database/supabase";
import { env } from "../config/environment";
import { SANTA_ROSA_BARANGAYS } from "../geography/barangays";

const attempts = new Map<string, { count: number; until: number }>();
export function allowBarangayLogin(ip: string, now = Date.now(), limit = 10) {
  for (const [key, entry] of attempts)
    if (entry.until <= now) attempts.delete(key);
  let entry = attempts.get(ip);
  if (!entry) {
    if (attempts.size >= 5000) return false;
    entry = { count: 0, until: now + 15 * 60_000 };
    attempts.set(ip, entry);
  }
  return ++entry.count <= limit;
}
export async function listBarangays(_req: Request, res: Response) {
  const client = getSupabase();
  if (!client) {
    res.status(503).json({ error: "Administration is not configured." });
    return;
  }
  const { data, error } = await client
    .from("barangays")
    .select("id,name")
    .in("name", [...SANTA_ROSA_BARANGAYS])
    .order("name");
  if (error) {
    res.status(503).json({ error: "Could not load barangays." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({ barangays: data });
}
export async function signInBarangay(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const { barangayId, code } = req.body ?? {};
  const ip = req.ip ?? "unknown";
  const scope =
    typeof barangayId === "string" ? barangayId.slice(0, 36) : "invalid";
  if (
    !allowBarangayLogin(`all:${ip}`, Date.now(), 100) ||
    !allowBarangayLogin(`${ip}:${scope}`)
  ) {
    res
      .status(429)
      .json({ error: "Too many sign-in attempts. Try again in 15 minutes." });
    return;
  }
  if (
    typeof barangayId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(barangayId) ||
    typeof code !== "string" ||
    code.length < 12 ||
    code.length > 128
  ) {
    res
      .status(401)
      .json({ error: "The barangay or access code is incorrect." });
    return;
  }
  const service = getSupabase();
  if (!service || !env.supabaseAnonKey) {
    res.status(503).json({ error: "Administration is not configured." });
    return;
  }
  const { data: account, error: accountError } = await service
    .from("barangay_access_accounts")
    .select("user_id")
    .eq("barangay_id", barangayId)
    .maybeSingle();
  if (accountError) {
    res.status(503).json({
      error:
        "Barangay access setup is incomplete. Contact the system operator.",
    });
    return;
  }
  if (!account) {
    res
      .status(401)
      .json({ error: "The barangay or access code is incorrect." });
    return;
  }
  const { data: profile } = await service
    .from("profiles")
    .select("role,barangay_id")
    .eq("id", account.user_id)
    .single();
  const { data: identity } = await service.auth.admin.getUserById(
    account.user_id,
  );
  if (
    profile?.role !== "BARANGAY_ADMIN" ||
    profile.barangay_id !== barangayId ||
    !identity.user?.email
  ) {
    res
      .status(401)
      .json({ error: "The barangay or access code is incorrect." });
    return;
  }
  // Codes are Supabase Auth passwords, hashed by Auth, never stored in a public
  // table, returned by the barangay directory, or embedded in frontend code.
  const auth = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.signInWithPassword({
    email: identity.user.email,
    password: code,
  });
  if (error || !data.session || data.user?.id !== account.user_id) {
    res
      .status(401)
      .json({ error: "The barangay or access code is incorrect." });
    return;
  }
  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
