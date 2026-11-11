# Supabase

For the current emergency assistance lifecycle, private tracking and migration
0018, follow [the assistance deployment guide](../backend/ASSISTANCE.md).
The location-sharing sections below describe the earlier 0011-0013 implementation;
0018 replaces its NEW/RESOLVED statuses and adds private recovery and dispatch.

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
   `migrations/0011_assistance_requests.sql`,
   `migrations/0012_cdrrmo_delete_assistance_requests.sql`,
   `migrations/0013_supplies_and_assistance_status.sql`,
   `migrations/0014_flood_severity_passability.sql`.
   Run `seed.sql` afterward to seed Santa Rosa City's 18 barangays and the
   Market Area Barangay Hall center record (capacity 500). Verify operational
   details with CDRRMO before relying on this record during an emergency.
   Other evacuation centers and hazards should be entered only from verified
   CDRRMO or barangay sources.
3. Fill in both:
   - `frontend/.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `backend/.env` — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
     (never expose the service role key to the frontend)
4. Apply migrations `0015_flood_road_sections.sql`,
   `0016_precise_flood_sections.sql`, and
   `0017_admin_roles_and_barangay_access.sql` after the preceding migrations.
5. Configure the separate admin website in `admin-frontend/`. Follow
   [admin-frontend/README.md](../admin-frontend/README.md) for account provisioning
   and deployment. CDRRMO uses `SUPER_ADMIN`; every barangay account must have
   its own assigned `barangay_id`. Null assignments no longer grant citywide access.
   No admin pages are deployed in the public `frontend/` website.
   Barangay staff now use 18 assigned email/password accounts instead of the
   shared entry login and access codes. Follow
   [the account migration guide](../backend/BARANGAY_ACCOUNTS.md) to reuse the
   existing Auth identities. This login change needs no new SQL migration;
   retain migration 0017 and the historical private mapping table.
6. For emergency request tracking, apply `0018_emergency_assistance_tracking.sql`
   and configure the backend-only `ASSISTANCE_TRACKING_SECRET` as described in
   [the assistance guide](../backend/ASSISTANCE.md).
7. For CDRRMO to report earthquake road damage directly, apply
   `0019_standalone_earthquake_road_impacts.sql`. It makes the source event
   optional without deleting events, road impacts, or role policies.
8. For earthquake debris-area reports, apply
   `0020_earthquake_impact_areas.sql` in the Supabase SQL Editor.
   Deploy/restart the backend and both frontends together.
   CDRRMO clicks the observed debris location, drags the centre to move it,
   and drags the edge handle or adjusts the radius (5-250 m) to resize it.
   Road checkboxes confirm which intersecting roads actually have damage.
   Grey sections are candidates; purple sections are selected. Only checked
   road sections inside the circle are saved, in one atomic operation.
   The backend recomputes the clipped geometry and validates the selection.
   Public maps and online/offline routing use these same intervals. Verified
   dates remain automatic and display in PHT. Existing whole-road reports
   retain their saved scope.
   Offline format 4 includes precise earthquake intervals. Reconnect to download
   a fresh offline snapshot after updating.

9. Apply `0021_public_routing_realtime.sql` to publish public flood, fire,
   earthquake and evacuation-center changes to Supabase Realtime. Existing
   RLS policies and private assistance tables are unchanged. Deploy the public
   frontend after applying the migration. The public app refreshes on changes,
   reconnect/focus and every 15 seconds while visible/online as a fallback.
   Existing routes are withheld while current hazards are rechecked. Failed
   verification stops guidance; it never silently substitutes an old online
   route. Offline routing still uses downloaded data and cannot receive changes
   without a connection; known-stale offline data is disabled until refreshed.

## Rectangular earthquake debris selection

Apply `0022_earthquake_rectangular_areas.sql` after migration 0020, then deploy
the backend and both frontends. CDRRMO can click and drag a rectangle around
observed debris, move its centre or resize a corner, then confirm affected
roads. Each side is bounded to 5–500 metres. The backend clips only the selected
roads to the rectangle and recomputes all routing intervals before saving.
Existing circular and whole-road reports remain supported. This migration
changes the footprint constraint; it does not delete reports or change RLS.

## Retiring shelter supplies

Shelter-supply tracking is no longer used. Deploy the updated backend and admin
frontend first, then apply `0023_remove_shelter_supplies.sql` to remove the four
supply columns, their timestamp trigger and its function. Applying this migration
permanently removes any stored supply values. Center records, occupancy,
availability and emergency assistance tracking remain intact.

Keep `0013_supplies_and_assistance_status.sql` in the migration history: it also
creates assistance status fields and a trigger required by migration 0018.
Fresh databases apply 0013 and later remove only its supplies portion via 0023.

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
  configured yet; operators must manage retention. No verified
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

### Archived assistance requests

The shared-location dashboard shows compact cards with optional names/contact,
travel mode, GPS accuracy and coordinates. Nearby street names are resolved
from the backend's existing local OSM road graph, never an external geocoder.
They are displayed as **Near [road name]**, not verified addresses. If the
nearest road is unnamed, farther than 150 m, or road data is unavailable, the
card keeps the coordinates and displays **Street name unavailable**. This also
works for existing submissions, without a database migration. Timestamps,
destination and the reference ID are under **Request details**.

Cancelled and completed requests automatically move from **Active requests**
to the read-only **Archive** tab. Locations and status history remain available
until existing scheduled retention cleanup removes them. Archiving does not
reopen requests or change public request tracking. The legacy permanent-delete
API is no longer offered by the shared-location interface.

### Archived hazards

Apply `0025_cdrrmo_hazard_archives.sql` after `0024` before deploying the
updated backend and admin frontend. Removed hazard records are preserved in
a private CDRRMO archive. Confirming **Restore hazard** republishes the original
record and its saved road restrictions. Failed removal or restoration rolls
back without discarding the record. Previously deleted hazards cannot be
recovered by this migration. See [archive deployment and behavior](../backend/ARCHIVES.md).

Apply `0026_delete_hazard_archives.sql` after `0025` to enable **Delete permanently**
in the hazard archive. This confirmed CDRRMO-only action deletes the saved
archive permanently; it does not delete active hazard reports. Do not rerun
`0025` if it is already installed.

Apply `0027_delete_active_hazards.sql` to enable the separate confirmed **Delete**
action beside **Archive** in active hazard records. Shared location Archive also
offers confirmed permanent deletion of completed/cancelled requests, using the
existing closed-request deletion policy and cascading status-history cleanup.

# Flood severity and routing

Apply `0014_flood_severity_passability.sql` to align existing reports and future
writes: LOW/MODERATE remain routable with flood-risk penalties; HIGH/SEVERE
hard-block the road. NONE adds no flood restriction. Passability is derived
from severity, not an independently editable checkbox. Other hazards and road
access rules can still block a road. Routable does not mean guaranteed safe.

### Earthquake area-only reports

Apply `0024_earthquake_area_only_reports.sql` after the existing migrations
before saving an earthquake area with no roads selected. Deploy the updated
backend and public frontend before creating these reports, then the admin app.
The migration preserves existing records and RLS permissions.

CDRRMO can draw and save a debris area without selecting roads. Such a record
has `road_id = NULL`, `confirmed_blocked = false` and empty road intervals.
It appears on both maps but does not alter road risk, route costs or closures,
including offline routing. Selecting roads still requires verified damage;
only those sections receive risk, and only confirmed blockages exclude them.
An area-only report does not certify that surrounding roads are safe.
