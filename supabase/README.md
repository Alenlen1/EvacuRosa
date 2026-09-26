# Supabase

## Setup

1. Create a project at https://supabase.com.
2. In the SQL editor, run all migrations **in order**:
   `migrations/0001_evacuation_centers.sql`,
   `migrations/0002_flood_reports.sql`,
   `migrations/0003_fire_incidents.sql`,
   `migrations/0004_earthquake_events.sql`,
   `migrations/0005_unique_constraints.sql`,
   `migrations/0006_citywide_evacuation_admin.sql`,
   `migrations/0007_remove_placeholder_data.sql`,
   `migrations/0008_superadmin_delete_earthquake_events.sql`,
   `migrations/0009_barangay_only_center_management.sql`,
   `migrations/0010_add_santa_rosa_multipurpose_complex.sql`,
   `migrations/0011_assistance_requests.sql`.
   Run `seed.sql` afterward to seed Santa Rosa City's 18 barangays and the
   Market Area Barangay Hall center record (capacity 500). Verify operational
   details with CDRRMO before relying on this record during an emergency.
   Other evacuation centers and hazards should be entered only from verified
   CDRRMO or barangay sources.
3. Fill in both:
   - `frontend/.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `backend/.env` — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
     (never expose the service role key to the frontend)
4. Create a barangay admin login: in Supabase Auth, add a user (email +
   password), then insert a matching row into `profiles` with that user's
   `id`, `role = 'BARANGAY_ADMIN'`, and the `barangay_id` they manage.
   **To make them a citywide evacuation-center admin instead** (manages
   every barangay's centers, but still can't touch flood/fire/earthquake
   — that stays `SUPER_ADMIN`-only), leave `barangay_id` as `null`.
5. Sign in at `/admin/login` in the frontend with that account.

## Without a Supabase project

Public evacuation-center and hazard endpoints return empty collections.
Admin login and update/create flows remain unavailable until the setup above
is complete.

Real road data works the same way — see `backend/scripts/fetch-santa-rosa-roads.ts`.

## Consented hazard-blocked location sharing

Apply migration `0011_assistance_requests.sql` using `npx supabase db push`
against your intended linked project, then restart the backend/frontend.
This change does not seed personal data or automatically contact emergency services.

- The routing response identifies `HAZARD_BLOCKED` only if the same road graph
  and travel mode can connect the endpoints without active hazard overrides.
  That diagnostic path is never returned or recommended. Access/one-way rules
  remain in force. An unrelated routing/network failure does not prompt sharing.
- For evacuation searches, the prompt appears when no available center is
  reachable and at least one candidate fails because of hazard closures.
- Users may decline. On explicit submission, the app requests a fresh GPS fix,
  sends a single snapshot (coordinates, accuracy, timestamp, destination and
  travel mode), plus optional name/contact number. The backend rechecks hazards.
  No continuous tracking, local storage, offline queue, or public personal-data
  endpoint is used. Contact numbers and coordinates are user-supplied/unverified.
- Only `SUPER_ADMIN` (CDRRMO) can read the table through its RLS policy and the
  authenticated dashboard endpoint. Barangay admins and anonymous clients
  cannot read it or insert directly. Intake uses the backend-only service key.
- Dashboard shows the latest 100 records and polls every 30 seconds while open;
  it is not a push notification or guaranteed monitored dispatch channel.
- Intake allows five attempts per source IP per 15 minutes per backend process,
  with bounded memory. Repeated submissions from the same form use a UUID to
  avoid duplicate inserts. Behind a proxy, configure a trusted proxy policy
  for the actual deployment topology (never blindly trust forwarded headers),
  and use a shared gateway limit before deploying multiple instances. The
  conservative default may share the limit among users behind a proxy/NAT.
- Before public rollout, agree with CDRRMO on monitoring, retention/deletion,
  privacy notice and incident-response procedures. No automatic deletion is
  configured yet; service-role operators must manage retention. No verified
  emergency numbers or rescue promises are introduced by this feature.

### Acceptance checks (use test data, not a real emergency)

1. In a development database, block all mapped routes to a destination using a
   hazard report. Try routing: confirm the sharing prompt appears on desktop/mobile.
2. Choose **Not now**: confirm no assistance row is created. Retry, review sharing
   details, and submit: confirm a success receipt and exactly one private row.
3. As CDRRMO/SUPER_ADMIN, open the dashboard: confirm the snapshot/name/contact
   appears on refresh. A barangay account must get HTTP 403 for the admin endpoint;
   direct anonymous Supabase SELECT/INSERT must fail, and a barangay SELECT must
   not return any rows.
4. Test location permission denial, offline submission, missing migration and
   retrying a submission: errors must not claim rescue dispatch or confirmed delivery.
5. Remove the hazard or pick an accessible alternative: normal routes should work
   without prompting. A disconnected road, forbidden travel mode, full centers,
   or network error alone must not be labeled a hazard-blocked route.
