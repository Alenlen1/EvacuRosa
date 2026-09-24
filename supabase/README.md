# Supabase

## Setup

1. Create a project at https://supabase.com.
2. In the SQL editor, run all seven migrations **in order**:
   `migrations/0001_evacuation_centers.sql`,
   `migrations/0002_flood_reports.sql`,
   `migrations/0003_fire_incidents.sql`,
   `migrations/0004_earthquake_events.sql`,
   `migrations/0005_unique_constraints.sql`,
   `migrations/0006_citywide_evacuation_admin.sql`,
   `migrations/0007_remove_placeholder_data.sql`.
   Run `seed.sql` afterward to seed Santa Rosa City's 18 barangays. It does
   not create evacuation centers or hazards; enter those only from verified
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
