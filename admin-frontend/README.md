# EvacuRosa administration

Separate Next.js website for CDRRMO and barangay personnel. Public maps and
navigation remain in `frontend/`; both sites use the same backend and database.
Existing admin maps and components were moved here; shared UI/styles/services
are imported from `frontend/src` through the TypeScript alias fallback.

## Setup and deployment order

1. Back up the database. Apply all preceding migrations, then
   `supabase/migrations/0017_admin_roles_and_barangay_access.sql` in Supabase.
   The migration seeds the 18 barangays, protects operational vs record fields,
   removes citywide barangay write access, and adds a private account mapping.
2. Review existing profiles. CDRRMO staff use `SUPER_ADMIN` accounts. Retire
   developer credentials through the designated system operator. Existing
   `BARANGAY_ADMIN` accounts with a null barangay can open only the selection
   page after signing in; center operations remain denied until a barangay code
   establishes a scoped session. Do not restore the old citywide exception. No accounts or credentials are
   reassigned automatically. CDRRMO has no barangay-account management screen.
   For a new CDRRMO staff member, the designated operator creates an Auth user
   in Supabase and inserts its UUID into `profiles` with `role = 'SUPER_ADMIN'`
   and `barangay_id = null`. Confirm the new staff login before retiring an
   existing developer account. Do not change unrelated users' profiles.
3. From the repository root, run `npm ci`. Use the existing CDRRMO and shared
   barangay Supabase Auth email/password accounts. The shared barangay account
   has a `BARANGAY_ADMIN` profile and opens the barangay selection page.
   Run `npx tsx backend/scripts/provision-barangay-access.ts` to create missing
   private code identities for all 18 barangays. Each identity has its own
   assigned profile; existing mappings and credentials are preserved.
   Initial codes are saved in an ignored `.runtime/barangay-access-*.json` file.
   Distribute each code only to its respective barangay; never publish this file
   or put passwords or service keys in frontend variables.
4. Configure `admin-frontend/.env.local` from `.env.example`. Public Supabase
   URL/key may match the public site; the service-role key stays backend-only.
5. Local commands from the repository root:
   - `npm run dev:backend`
   - `npm run dev:frontend` (public, port 3000)
   - `npm run dev:admin` (admin, port 3001)
6. Deploy the backend with both frontend origins in `ALLOWED_ORIGINS`, separated
   by commas, including scheme and without trailing slashes. The server already
   reads its hosting provider's `PORT`.
7. Create a second Vercel project from this same repository. Set Root Directory
   to `admin-frontend`, enable inclusion of source files outside the Root
   Directory, use Next.js, and configure the public variables from `.env.example`.
   Build with `npm run build`; set the public application URL explicitly.
   Keep the original Vercel project's Root Directory as `frontend`.
8. Add the admin origin to Supabase's appropriate authentication URL settings.
   Both roles use the same email/password login page. CDRRMO opens the dashboard;
   barangay staff select a barangay and verify its code. Code verification replaces
   the entry session with a Supabase session scoped to that barangay. Changing
   barangays requires the new barangay's code. Verify both roles before publishing
   the public build without admin links. No SQL beyond migration 0017 is required.

## Permissions and behavior

Emergency request status tracking also requires migration 0018 and the backend's
ASSISTANCE_TRACKING_SECRET. See [the assistance guide](../backend/ASSISTANCE.md).

- CDRRMO registers centers, edits record details/capacity/assignment, deletes
  centers, and retains the hazard and shared-location tools. Existing supply
  controls are available during CDRRMO center editing.
- The barangay home/selection page shows a read-only citywide evacuation map
  using the public center endpoint and the public map's shelter markers/status
  symbols. Popups show address, occupancy and availability; Refresh map reloads
  the overview. A map failure does not prevent barangay selection.
- Barangay search filters the directory and focuses the map on a named barangay,
  with its access card beside the map (below it on small screens). Clear search
  restores the full directory. Search also works without registered center data;
  opening a workspace still requires its private access code. Bundled area
  locations use the same PSA/NAMRIA-derived source as the city boundary; see
  [the location source and license](src/lib/barangayLocations.LICENSE.txt).
- Each barangay's occupancy dashboard has no map and shows only assigned centers. They
  can update occupancy and choose accepting evacuees or closed/unavailable.
  Availability is computed consistently: 70% nearly full, 90% full, zero capacity
  closed. Reopening a full center cannot override the occupancy restriction.
  Barangay home returns to the citywide overview and barangay selection.
- Public center details remain publicly readable for evacuation guidance.
  Private account mappings and administrative actions remain protected.
- Backend filters and RLS restrict rows; a database trigger restricts columns
  even for direct Supabase REST calls. Missing profiles/assignments fail closed.
- Barangay codes must contain exactly six letters (A-Z, a-z) or digits (0-9).
  Letters are case-sensitive. Spaces, symbols and other lengths are rejected.
  Existing six-digit codes still work. Code changes must also satisfy the project's Supabase Auth policy.
- The barangay selection page uses the code-login API. Code attempts are limited
  per IP/barangay and globally per IP. A shared proxy
  or NAT shares the outer limit. Multiple backend instances need a shared gateway
  rate limiter before wider rollout. Codes identify a barangay, not an individual;
  distribute only to authorized staff and rotate compromised credentials through
  the designated system operator. There is no public code reset or signup flow.
- This split does not introduce realtime public hazard updates. Public/offline
  freshness and routing behavior retain their existing implementation.

## Verification

Run `npm test --workspace=backend`, `npm test --workspace=frontend`, and builds
for all three workspaces. The SQL permission regression script is
`backend/scripts/test-admin-role-permissions.sql`; it refuses to run unless the
database is named `evacurosa_role_test`. Use a local isolated fixture with `auth.uid`,
Auth user IDs, Supabase-style roles, and all migrations. It rolls back test data.
It is not a production provisioning script.
