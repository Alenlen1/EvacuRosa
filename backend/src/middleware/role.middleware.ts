import type { NextFunction, Response } from "express";
import type { AuthedRequest } from "./auth.middleware";

export interface Profile {
  id: string;
  role: "BARANGAY_ADMIN" | "SUPER_ADMIN";
  barangay_id: string | null;
  full_name: string | null;
}

export interface RoleAwareRequest extends AuthedRequest {
  profile?: Profile;
}

/** Loads the caller's admin profile. This is a convenience check for nicer
 * error messages — the actual authorization boundary is the RLS policy on
 * evacuation_centers, which is enforced regardless of what happens here. */
export async function attachProfile(req: RoleAwareRequest, res: Response, next: NextFunction) {
  if (!req.userSupabase || !req.supabaseUser) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const { data, error } = await req.userSupabase
    .from("profiles")
    .select("id, role, barangay_id, full_name")
    .eq("id", req.supabaseUser.id)
    .single();

  if (error || !data) {
    res.status(403).json({ error: "No admin profile found for this account." });
    return;
  }

  req.profile = data as Profile;
  next();
}

/** Convenience check for nicer error messages — RLS is still the real
 * enforcement boundary regardless of what this middleware decides. */
export function requireRole(...allowed: Profile["role"][]) {
  return (req: RoleAwareRequest, res: Response, next: NextFunction) => {
    if (!req.profile || !allowed.includes(req.profile.role)) {
      res.status(403).json({ error: "Not authorized for this action." });
      return;
    }
    next();
  };
}
