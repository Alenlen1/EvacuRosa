-- EvacuRosa: flood reports, citywide (CDRRMO / SUPER_ADMIN) managed.
-- road_id matches a roadId in the road graph JSON, not a DB foreign key —
-- the road network itself isn't in Supabase (it comes from OpenStreetMap).

create table if not exists flood_reports (
  id uuid primary key default gen_random_uuid(),
  road_id text not null,
  barangay_id uuid references barangays (id),
  severity text not null check (severity in ('NONE', 'LOW', 'MODERATE', 'HIGH', 'SEVERE')),
  water_level_meters double precision,
  road_impassable boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'MONITORING', 'RESOLVED')),
  notes text,
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reported_by uuid references profiles (id)
);

create index if not exists flood_reports_road_id_idx on flood_reports (road_id);
create index if not exists flood_reports_status_idx on flood_reports (status);

alter table flood_reports enable row level security;

create policy "flood_reports_public_read"
  on flood_reports for select
  using (true);

-- Flood data is citywide/CDRRMO-managed — barangay admins do not get write
-- access here, unlike evacuation_centers.
create policy "flood_reports_superadmin_insert"
  on flood_reports for insert
  to authenticated
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );

create policy "flood_reports_superadmin_update"
  on flood_reports for update
  to authenticated
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );

create policy "flood_reports_superadmin_delete"
  on flood_reports for delete
  to authenticated
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );

create trigger flood_reports_set_updated_at
  before update on flood_reports
  for each row execute function set_updated_at();
