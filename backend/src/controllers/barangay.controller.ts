import type { Request, Response } from "express";
import { getSupabase } from "../database/supabase";
import { SANTA_ROSA_BARANGAYS } from "../geography/barangays";

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
