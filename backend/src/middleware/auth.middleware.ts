import type { NextFunction, Request, Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/environment";

export interface AuthedRequest extends Request {
  supabaseUser?: { id: string; email?: string };
  /** Scoped to the calling user's own JWT — queries through this client run
   * AS that user, so RLS is the thing actually deciding what they can touch. */
  userSupabase?: SupabaseClient;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    res.status(503).json({
      error: "Admin authentication isn't configured on this server yet.",
    });
    return;
  }

  const token = authHeader.slice("Bearer ".length);
  const userClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired session." });
    return;
  }

  req.supabaseUser = { id: data.user.id, email: data.user.email ?? undefined };
  req.userSupabase = userClient;
  next();
}
