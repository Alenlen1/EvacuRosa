import { rateLimit } from "express-rate-limit";

// One budget across both routing actions; switching endpoints cannot reset it.
// Road previews have their own allowance for interactive hazard placement.
export function createPublicComputeLimiters() {
  const create = (limit: number, error: string) =>
    rateLimit({
      windowMs: 60_000,
      limit,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      handler: (_req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.status(429).json({ error });
      },
    });
  return {
    routing: create(
      60,
      "Too many route requests. Please wait a minute before trying again.",
    ),
    roadPreview: create(
      120,
      "Too many road preview requests. Please wait a minute before trying again.",
    ),
  };
}

export const publicComputeLimiters = createPublicComputeLimiters();
