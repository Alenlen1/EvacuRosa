# Supabase

## Setup (needed for Phase 3's admin features and real persistence)

1. Create a project at https://supabase.com.
2. In the SQL editor, run all six migrations **in order**:
   `migrations/0001_evacuation_centers.sql`,
   `migrations/0002_flood_reports.sql`,
   `migrations/0003_fire_incidents.sql`,
   `migrations/0004_earthquake_events.sql`,
   `migrations/0005_unique_constraints.sql`,
   `migrations/0006_citywide_evacuation_admin.sql`.
   Optionally run `seed.sql` afterward — it seeds all 18 of Santa Rosa
   City's real barangays plus a handful of sample centers spread across
   several of them (useful for testing barangay-scoped admin access).
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

`GET /api/evacuation-centers` and `GET /api/floods` still work — they fall
back to labeled dev fixtures, read-only. The admin login and update/create
flows genuinely need a real project; there's no meaningful fixture for
"authenticated write," so that part just won't work until you've done the
setup above.

Real road data works the same way — see `backend/scripts/fetch-santa-rosa-roads.ts`.
