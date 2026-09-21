-- EvacuRosa: fire incidents, citywide (CDRRMO / SUPER_ADMIN) managed.
-- Point-based (lat/lng + radius), unlike flood_reports which reference a
-- specific road directly — a fire's effect on nearby roads is computed by
-- proximity in the backend, not stored per-road here.

create table if not exists fire_incidents (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid references barangays (id),
  latitude double precision not null,
  longitude double precision not null,
  severity text not null check (severity in ('LOW', 'MODERATE', 'HIGH', 'SEVERE')),
  radius_meters double precision not null check (radius_meters > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CONTAINED', 'RESOLVED')),
  -- Section 30's rule mirrored from flood_reports: proximity to a fire
  -- never blocks a road by itself. Only a roadId explicitly listed here,
  -- meaning CDRRMO has confirmed that specific road is impassable, does.
  confirmed_blocked_road_ids text[] not null default '{}',
  notes text,
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reported_by uuid references profiles (id)
);

create index if not exists fire_incidents_status_idx on fire_incidents (status);

alter table fire_incidents enable row level security;

create policy "fire_incidents_public_read"
  on fire_incidents for select
  using (true);

create policy "fire_incidents_superadmin_insert"
  on fire_incidents for insert
  to authenticated
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );

create policy "fire_incidents_superadmin_update"
  on fire_incidents for update
  to authenticated
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );

create policy "fire_incidents_superadmin_delete"
  on fire_incidents for delete
  to authenticated
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );

create trigger fire_incidents_set_updated_at
  before update on fire_incidents
  for each row execute function set_updated_at();
