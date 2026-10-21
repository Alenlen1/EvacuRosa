# Backend on Railway

Keep the public and staff frontends on Vercel and the database on the existing
Supabase project. Deploy only one backend service/replica on Railway initially.
No database migration or credential changes are needed for these optimizations.

## Build and run

Connect the existing GitHub repository and select the branch containing the
backend changes. Keep the service Root Directory at the repository root (`/`),
because the npm workspaces and lockfile live there. Set Config File Path to
`/backend/railway.toml`. That file sets:

- Builder: Railpack
- Build command: `npm run build --workspace=backend`
- Start command: `node backend/dist/server.js`
- Healthcheck: `/api/health`

Set this service variable to install only the backend workspace and its build
tools, without installing either Next.js application:

```text
RAILPACK_INSTALL_CMD=npm ci --workspace=backend --include-workspace-root=false --include=dev
```

Set Node.js to version 24 (`RAILPACK_NODE_VERSION=24`) and add:

```text
NODE_ENV=production
SUPABASE_URL=<existing project URL>
SUPABASE_ANON_KEY=<existing anon or publishable key>
SUPABASE_SERVICE_ROLE_KEY=<existing server-only key>
ALLOWED_ORIGINS=https://evacu-rosa.vercel.app,https://evacurosa-ops.vercel.app
```

Use Railway's injected `PORT`; the Express server already reads it. Do not copy
an old `NODE_OPTIONS=--max-old-space-size=256` setting from Render. A heap limit
does not cap total process memory and setting it too low recreates heap crashes.
Start with the default Node heap settings and inspect Railway memory metrics.
If setting a replica memory ceiling, start at 512 MiB and monitor peak resident
memory; the JavaScript heap measurement excludes native memory and buffers.
Keep the service-role key out of both frontend projects and Git.

Generate the Railway HTTPS domain and verify `/api/health`. Set
`NEXT_PUBLIC_API_URL` to that origin in **both** Vercel projects and redeploy them;
Next.js embeds this value during the build. Verify hazard creation, a route around
a blocked section, evacuation recommendations, and both staff roles before
retiring the Render service. Never run both paid services longer than needed.

## Staying within the budget

Hobby is a $5 minimum commitment with $5 of included resource usage, not a $5
maximum invoice. Extra resource usage is billed. CPU, resident memory and egress
all contribute; a local benchmark cannot predict the monthly bill.

- Keep one replica. Do not add another database or deploy the frontends here.
- Check Workspace Usage and projected costs after realistic traffic.
- Set a Compute email alert below your budget and review the available hard
  limit before enabling automatic payment. Railway's support guidance describes
  a $10 minimum Compute hard limit, so do not assume a $5 cutoff is available.
- Do not use Railway Agent features if you do not want separate Agent usage.
- Optional Serverless sleeping reduces idle resource usage but adds a cold start.
  If enabled, remove external keep-alive monitors and test wake-up behavior.
- A hard Compute limit takes the service offline when reached. Neither this
  configuration nor the code changes set any billing limits on your account.

Official references:
[pricing](https://docs.railway.com/pricing),
[cost controls](https://docs.railway.com/pricing/cost-control),
[minimum hard-limit support guidance](https://station.railway.com/questions/the-estimated-usage-of-my-service-is-inc-009b8a2d),
[build configuration](https://docs.railway.com/builds/build-configuration),
[config as code](https://docs.railway.com/config-as-code/reference).

## What was optimized

- Nearby accessible-node lookup uses the existing spatial grid and a compact
  access mask. It preserves the 250 m maximum, travel-mode permissions and
  incoming one-way endpoints.
- Graph edges share identical permission arrays instead of retaining thousands
  of duplicate arrays. Graph permissions are treated as immutable.
- Route requests read flood/fire/verified earthquake inputs once each. An
  evacuation recommendation shares those inputs, graph preparation and fuzzy
  edge scores across all available centers. No candidates are skipped.
- Request-local caches are released after the recommendation. New requests
  read fresh hazards; database failures still fail instead of returning stale
  routes. Fuzzy inference and impassable-road exclusions remain active.

Run `npm test --workspace=backend`, `npm run build --workspace=backend`, and
`npm run benchmark:routing --workspace=backend` locally. The benchmark uses the
bundled OSM graph and synthetic hazard scenarios; it does not contact Supabase.

A local before/after run on the 61,720-node / 70,027-forward-edge graph measured
400 accessible-node lookups at about 9,847 ms before and 49-66 ms after; 12 sample
routes took about 661 ms before and 59-72 ms after. Retained JS heap after GC was
about 98 MiB before and 83 MiB after. Nearest-node IDs and complete route outputs
had identical checksums. A 12-edit flood-section stress run completed with a
256 MiB JS heap ceiling (about 126 MiB retained heap with a partition loaded).
These are local synthetic measurements, not Railway latency or billing estimates.
