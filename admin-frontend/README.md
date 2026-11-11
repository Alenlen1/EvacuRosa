# EvacuRosa administration

Separate Next.js website for CDRRMO and barangay personnel. Public maps and
navigation remain in `frontend/`; both sites use the same backend and database.
Shared UI/styles/services use the TypeScript alias fallback to `frontend/src`.

## Setup and deployment

1. Back up the database and apply the existing migrations in order. Migration
   `0017_admin_roles_and_barangay_access.sql` seeds the 18 barangays and enforces
   assigned-center operations. Keep all historical migration files.
2. CDRRMO staff use `SUPER_ADMIN`. Each barangay uses its own email/password Auth
   identity with `profiles.role = 'BARANGAY_ADMIN'` and its `barangay_id`.
   Unassigned/shared entry accounts cannot open a workspace. CDRRMO does not
   manage barangay administrators; provisioning belongs to the system operator.
3. Run `npm ci` from the repository root. Follow
   [the account setup guide](../backend/BARANGAY_ACCOUNTS.md) to fill the private
   18-email list, preview changes, migrate existing code identities without
   changing UUIDs, and retire the shared login after testing. Passwords replace
   the old six-character codes. Do not publish the list or credentials.
4. Configure `admin-frontend/.env.local` from `.env.example`. The public Supabase
   URL/key may match the public site. Service-role keys remain backend-only.
5. Run `npm run dev:backend`, `npm run dev:frontend` (public, port 3000), and
   `npm run dev:admin` (staff, port 3001) from the repository root.
6. Deploy the backend with both frontend origins in `ALLOWED_ORIGINS`, separated
   by commas, including scheme and without trailing slashes. The server reads
   the hosting provider's `PORT`.
7. Create a separate Vercel project for `admin-frontend`, enable source files
   outside the Root Directory, select Next.js, and set the public variables from
   `.env.example`. Build with `npm run build`. Keep the public project's Root
   Directory as `frontend` and set the public application URL explicitly.
8. Add the staff origin to Supabase's authentication URL settings. Both roles use
   the same email/password login page and open `/admin/dashboard`; the signed-in
   profile determines the workspace. Old `/admin/barangays` bookmarks redirect
   there without a selector. Deploy backend and staff frontend together. No new
   SQL migration is required for direct barangay account login.

## Permissions and behavior

- CDRRMO (Super Admin) registers and maintains evacuation center records and
  barangay assignments, hazards and roads. It retains maps and assistance
  monitoring. It does not supervise barangay administrators.
- Each Barangay Admin signs in directly to its own workspace. Summary, occupancy
  cards and read-only map share the authenticated assigned-center snapshot.
  Markers show location, capacity, occupancy and availability. Saving or
  refreshing updates this snapshot.
- Barangay staff can update only their centers' occupancy and availability.
  They cannot register/delete centers, change metadata/assignments, manage
  hazards, or open another barangay's administration. Public center information
  remains readable through the public map for evacuation guidance.
- Backend filters, RLS and the center-operation trigger remain enforced. Access
  comes from the authenticated profile, never email spelling, a URL parameter or
  client selection. Missing profiles/assignments fail closed.
- Supabase Auth handles email/password authentication and its configured login
  rate limits. There is no custom password endpoint or public staff signup
  screen. Disable public email signup in Supabase if it is not otherwise needed.
- The old private mapping table remains for migration/reference only. The code
  exchange endpoint and UI have been removed. Keep historical migrations.
- Shared-account retirement disables its Auth login and removes only its
  unassigned profile. Its Auth UUID stays for audit references. Retire only after
  testing all new accounts and permissions.

## Verification

Run `npm test --workspace backend`, `npm test --workspace admin-frontend`, and
build both workspaces. Provisioning safety tests cover collisions, assignment
mismatches, partial recovery and rerun behavior. The private setup guide includes
login, map, cross-barangay and direct-RLS checks.

The SQL regression script `backend/scripts/test-admin-role-permissions.sql`
refuses to run unless the database is named `evacurosa_role_test`. Use a local
isolated fixture with Supabase-style roles and all migrations; it rolls back test
data. It is not a production provisioning script.
