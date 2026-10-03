# Language, shelter supplies and assistance workflow

Apply `supabase/migrations/0013_supplies_and_assistance_status.sql` in the
Supabase SQL Editor after migrations 0001–0012, before deploying this code.
The migration preserves existing centers and requests. It initializes supplies
as unknown and existing requests as NEW. It does not submit requests or change
occupancy. The migration has not been applied to a live database by this change.

Public users can switch between English and Filipino in the header. The choice
is stored locally, without resetting the selected destination or submitting
location information. Place names and staff notes remain in their original
language. Administrative screens remain English.

Barangay staff can confirm drinking-water, food and first-aid supply levels in
their shelter cards. Saving records a server timestamp, even if the levels are
unchanged. Public center details and recommended-center routes display those
levels and flag supply information older than 24 hours. Occupancy-only updates
do not refresh the supply timestamp. Existing offline caches display missing
supply values as unknown until fresh center data is loaded.

CDRRMO staff can acknowledge a new assistance request, then mark it resolved.
Acknowledgement does not mean responders were dispatched. Resolution does not
delete personal information; the existing explicit deletion action remains.
Requests are private, and updates use the caller's JWT and existing role checks.
Database grants permit only the status column to be updated. A trigger enforces
forward transitions and records the authenticated user and server time.

## Verify after applying the migration

- As a barangay administrator, save supplies for an assigned center and confirm
  the public details. Confirm another barangay's center is still protected by
  the existing RLS policy.
- As CDRRMO, acknowledge and resolve an authorized test request. A second stale
  update should return a conflict. Confirm public and barangay users cannot
  read or update private assistance requests.
- Switch languages while a destination is selected, reload, and check that the
  preference persists. Device location and routing remain subject to the
  existing browser permissions.

Local automated tests cover API validation, permitted status transitions,
authorization, stale-update conflicts and translated consent wording. Live
Supabase policy execution needs a configured test database; do not create
fictional emergency requests in the operational system for testing.

Verification for this change: 127 backend and 59 frontend tests passed; both
production builds passed. Headless Edge checks with mocked APIs verified saved
language preference, destination preservation, mobile width, supply details and
the stale warning, barangay supply-form submission, and CDRRMO acknowledgement
and resolution. No live database writes were made during these checks.
