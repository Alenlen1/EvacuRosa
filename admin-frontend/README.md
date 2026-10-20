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
   `BARANGAY_ADMIN` accounts with a null barangay are deliberately denied;
   do not restore the old citywide exception. No accounts or credentials are
   reassigned automatically. CDRRMO has no barangay-account management screen.
   For a new CDRRMO staff member, the designated operator creates an Auth user
   in Supabase and inserts its UUID into `profiles` with `role = 'SUPER_ADMIN'`
   and `barangay_id = null`. Confirm the new staff login before retiring an
   existing developer account. Do not change unrelated users' profiles.
3. From the repository root, run `npm ci`. Provision missing barangay access
   accounts with `npx tsx backend/scripts/provision-barangay-access.ts` using
   the operator's backend Supabase environment. This creates one authenticated
   identity per barangay and random unique codes; existing mappings are skipped.
   Supabase Auth stores the password hashes. Plaintext initial codes are saved
   only in an ignored `.runtime/` file: distribute individually and remove the
   file after secure handoff. Never put codes or service keys in frontend variables.
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
   CDRRMO uses its existing email/password sign-in; barangays select a card and
   provide their private code. These are real Supabase sessions, not a client-side
   flag. Verify both roles before publishing the public build without admin links.

## Permissions and behavior

- CDRRMO registers centers, edits record details/capacity/assignment, deletes
  centers, and retains the hazard and shared-location tools. Existing supply
  controls are available during CDRRMO center editing.
- Barangays see only assigned centers in their administration workspace. They
  can update occupancy and choose accepting evacuees or closed/unavailable.
  Availability is computed consistently: 70% nearly full, 90% full, zero capacity
  closed. Reopening a full center cannot override the occupancy restriction.
- Public center details remain publicly readable for evacuation guidance.
  Private account mappings and administrative actions remain protected.
- Backend filters and RLS restrict rows; a database trigger restricts columns
  even for direct Supabase REST calls. Missing profiles/assignments fail closed.
- Code attempts are limited per IP/barangay and globally per IP. A shared proxy
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
