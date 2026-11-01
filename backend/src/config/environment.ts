import "dotenv/config";

export function parseTrustProxyHops(value = "0"): number {
  if (!/^[0-5]$/.test(value))
    throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 5.");
  return Number(value);
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  // Trust no forwarded IP headers locally. Set only for the actual proxy path.
  trustProxyHops: parseTrustProxyHops(process.env.TRUST_PROXY_HOPS),
  // Comma-separated list; defaults to local dev only. Set to the real
  // Vercel URL(s) in production — see DEPLOYMENT.md. Section 68's "no
  // hardcoded production URLs" rule applies here as much as anywhere else.
  allowedOrigins: (
    process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:3001"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
};
