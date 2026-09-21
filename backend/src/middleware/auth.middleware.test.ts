import { describe, expect, it, vi } from "vitest";
import { requireAuth, type AuthedRequest } from "./auth.middleware";

// These cover the paths that don't require a live Supabase project — the
// "valid token" success path genuinely needs a real project to test
// meaningfully and is documented as a manual/integration check instead
// (see supabase/README.md). This is the automated version of what was
// previously only checked by hand with curl.

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("requireAuth", () => {
  it("rejects a request with no Authorization header at all", async () => {
    const req = { headers: {} } as AuthedRequest;
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a header that isn't a Bearer token", async () => {
    const req = { headers: { authorization: "Basic abc123" } } as AuthedRequest;
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 503 rather than crashing when Supabase isn't configured", async () => {
    // The test environment has no SUPABASE_URL/ANON_KEY set, which is
    // exactly the "not configured yet" state this path exists for.
    const req = { headers: { authorization: "Bearer sometoken" } } as AuthedRequest;
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
});
