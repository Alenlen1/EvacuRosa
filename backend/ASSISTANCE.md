# Emergency assistance and private status tracking

This extends the existing `assistance_requests` table, CDRRMO assistance list,
reported-location map and public Emergency dialog. It does not change routing,
fuzzy rules, hazard inputs, navigation or barangay center permissions.

## Deploy in order

1. Back up Supabase. Review and apply
   `supabase/migrations/0018_emergency_assistance_tracking.sql` after 0001-0017.
   Deploy the backend and both frontends together during a planned update: the
   old status vocabulary is replaced by the audited lifecycle below.
2. Add **ASSISTANCE_TRACKING_SECRET** to the backend environment only. Generate
   at least 32 random bytes, for example in a private local terminal:
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   Keep it stable across instances/redeployments. Never use a NEXT_PUBLIC variable.
3. Keep SUPABASE_URL, SUPABASE_ANON_KEY (or publishable key), and
   SUPABASE_SERVICE_ROLE_KEY configured for the same existing project. Both Vercel
   origins must remain in ALLOWED_ORIGINS. No new frontend variables are needed.
4. Verify Supabase Realtime is enabled and the `assistance_requests` table appears
   in the `supabase_realtime` publication. The migration adds it if that publication
   exists. No anonymous assistance SELECT or anonymous Realtime policy is added.
5. Deploy the Node backend on Render/Railway and redeploy both Next.js sites.
   Both NEXT_PUBLIC_API_URL values must use that backend's HTTPS origin.
   Proxy/CDN settings must permit streaming `text/event-stream` responses without
   buffering. CORS preflight must allow the Authorization header.
6. Test with a public browser and an authorized CDRRMO browser on a clearly
   coordinated test request. Verify the deployment's actual Supabase Realtime
   transport; local tests simulate Auth/Realtime infrastructure. Do not send fake
   emergency requests to an operational dashboard without coordinating the test.
7. Schedule `select public.purge_expired_assistance();` daily through the database
   operator's existing scheduler. No cron extension or billing service is installed
   automatically. Completed/cancelled requests are deleted after 30 days; every
   request is deleted after 90 days. Its status history is deleted with it.

## Status lifecycle

`PENDING -> ACKNOWLEDGED -> DISPATCHED -> COMPLETED`.
Any active status may become `CANCELLED`; closed requests cannot be reopened.
The backend requires explicit confirmation for dispatch, completion and staff
cancellation. The UI asks operators to confirm actual dispatch before telling
users Help Is on the Way. Acknowledgment explicitly says no team is dispatched.
If dispatch fails, staff coordinate the response and can cancel the request;
never mark it completed or dispatched without the corresponding real action.

A database trigger validates transitions, increments a version, stamps actor/time
and writes immutable history in the same transaction. Conditional version/status
updates reject stale or simultaneous changes with 409. Legacy NEW/RESOLVED rows
become PENDING/COMPLETED; existing records receive a SYSTEM history entry without
inventing a dispatch event. They have no new tracking token and remain staff-only.

## Public workflow

Emergency -> Request Assistance -> review sharing explanation -> Share GPS
location -> review coordinates/accuracy -> Confirm and Submit Request.
This also reuses the hazard-blocked-route assistance prompt, retaining its selected
travel mode and destination context. An emergency request no longer requires the
route engine to prove a blockage before staff can receive it.

GPS permission, availability and timeout errors are explained separately. Readings
older than two minutes must be refreshed before submission. Poor accuracy is shown
with an explicit uncertainty warning. Offline or backend failures never show a new
successful submission. Use verified official emergency communication channels if
online submission fails; existing unverified phone buttons are not invented or
silently enabled by this change.

A single active request is restored on refresh/reopening through local storage.
Existing requests reopen their tracker instead of submitting another. A pending
submission is persisted before sending so lost responses can be recovered without
resubmitting a second record. Clearing site data, using a different device/browser,
or denying storage prevents automatic recovery. No continuous GPS is collected.

Tracking credentials expire after seven days. Expired/unknown credentials return
404 without disclosing whether another person's request exists. Contact CDRRMO
through official channels if tracking expires while assistance is still needed.
Rotating ASSISTANCE_TRACKING_SECRET preserves already-issued token authentication
but prevents recovery of lost responses generated under the previous secret.

## Security and real-time transport

- The browser creates a random UUID and a 256-bit retry key before submission.
  The backend derives a deterministic, cryptographically secure 256-bit tracking
  capability with HMAC-SHA256, allowing an idempotent retry after a lost response.
  The database stores only SHA-256(token); request IDs alone authorize nothing.
- The atomic creation RPC returns the existing row only for the same tracking
  hash. A different caller cannot overwrite or recover a guessed UUID.
- Public status, cancellation and subscription endpoints authenticate the token
  in an Authorization header. Tokens never appear in query strings, logs or map
  URLs. The retry key is sent in a private POST body. Private responses use no-store.
- Only authenticated SUPER_ADMIN staff can read or mutate the CDRRMO assistance
  list. Barangay admins and anonymous database clients cannot access these rows
  or history. Staff SELECT grants exclude tracking token hashes.
- One server-only Supabase Realtime Postgres Changes subscription fans out small
  invalidations through backend-authorized, request-scoped Server-Sent Events.
  The browser retrieves its own latest snapshot using its capability. It cannot
  subscribe to another request with only an ID. Staff have a separately authorized
  stream for list invalidations. No public Supabase channel is used.
- API mutations also invalidate active streams immediately after the committed
  database write. The database subscription covers other backend instances and
  operator changes. SSE is a real-time transport; no new WebSocket package is needed.
- On live connection failure, active clients poll securely every 12 seconds.
  Reconnection uses bounded backoff; online/visibility/reconnection events trigger
  fresh reads. A 60-second verification handles an apparently healthy but silent
  stream. Versions prevent older results replacing newer ones, and subscriptions,
  timers and fetches are cleaned up. Closed requests stop automatic tracking.
- SSE subscriptions are bounded globally and per request, have heartbeats, and
  reauthorize after five minutes. Public capabilities also expire. Browser storage
  is not trusted as server authorization. React escapes rendered user fields and
  cross-origin document referrers contain only the website origin, as required by
  OpenStreetMap tiles, without page paths or queries. Preserve these XSS protections.
- Intake and tracking have bounded per-process rate limits. req.ip is not taken
  from untrusted forwarded headers. NAT/proxy users share the outer IP limit;
  configure a shared trusted gateway limiter before scaling beyond one instance.
- Browser closure does not guarantee background status updates, GPS, notifications,
  rescue vehicle tracking or dispatch. Push notifications remain a separate feature.

## Existing routes extended

- POST `/api/assistance-requests`: fresh GPS, explicit consent, UUID and retry key;
  returns the saved request, history and tracking token only after save confirmation.
- GET `/api/assistance-requests/:id`: private owner snapshot and timeline.
- POST `/api/assistance-requests/:id/recover`: recover a lost response with retry key.
- GET `/api/assistance-requests/:id/events`: capability-authorized event stream.
- POST `/api/assistance-requests/:id/cancel`: owner cancellation.
- GET `/api/admin/assistance-requests`: CDRRMO list with optional status filter.
- GET `/api/admin/assistance-requests/events`: CDRRMO list invalidation stream.
- GET `/api/admin/assistance-requests/:id`: CDRRMO details/history.
- PATCH `/api/admin/assistance-requests/:id`: status, current version and confirmation.
- DELETE `/api/admin/assistance-requests/:id`: explicit deletion of a closed record.

The public service worker already bypasses all `/api/` requests and remote API
origins. Request data and tracking responses are never put in its offline caches.
Local cached status is clearly marked outdated until refreshed after recovery.

## Verification

Run backend/frontend unit tests and all three workspace builds. The isolated SQL
regression is `backend/scripts/test-assistance-permissions.sql`; it refuses any
name other than `evacurosa_role_test` and rolls back test records. It verifies RLS,
tracking-hash privacy, duplicate ownership, transitions, stale writes, timestamps,
actor history and public cancellation. It is not a production setup script.

Implementation verification: 263 backend tests and 127 public frontend tests passed,
as did backend, public frontend and admin frontend production builds. All 18 SQL
migrations were applied to a fresh local PostgreSQL database, and the isolated SQL
regression passed, including retention cleanup. Separate public/staff browser
contexts verified submission, persistence, automatic status changes, refresh/reopen,
owner isolation, offline/reconnect and polling fallback. A mobile browser check
verified GPS errors, poor accuracy, lost-response recovery without duplicates,
concurrent staff updates, cancellation history and barangay denial. These checks
used real backend controllers and local PostgreSQL, with simulated GPS, Supabase
Auth and Realtime infrastructure; they do not verify hosted Supabase or real devices.

Use two browser contexts/devices for submission -> acknowledgement -> dispatch ->
completion; refresh/reopen the public PWA, interrupt the event stream, verify polling
and connectivity restoration, and test a second unrelated user's inability to read
or subscribe to the first request. Also test denied GPS, offline submission, poor
accuracy, lost POST responses, cancellation, concurrent actions and terminal states.
