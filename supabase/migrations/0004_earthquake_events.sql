-- EvacuRosa: earthquake events (raw feed data, informational only) and
-- earthquake_road_impacts (CDRRMO's verified per-road assessment — the
-- ONLY thing that ever affects routing; the event itself never does).

create table if not exists earthquake_events (
  id uuid primary key default gen_random_uuid(),
  external_event_id text unique,
  latitude double precision not null,
  longitude double precision not null,
  magnitude double precision not null,
  depth_km double precision,
  occurred_at timestamptz not null,
  source text not null default 'USGS',
  status text not null default 'UNREVIEWED' check (status in ('UNREVIEWED', 'REVIEWED', 'ARCHIVED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists earthquake_events_occurred_at_idx on earthquake_events (occurred_at desc);

-- Section 31's "Correct flow": Earthquake Event -> CDRRMO Review / Verified
-- Impact -> Road Damage/Closure -> Routing Impact. This table IS that
-- review step. No row here for a road means that road is unaffected by
-- this earthquake, full stop — magnitude/depth alone never imply damage.
create table if not exists earthquake_road_impacts (
  id uuid primary key default gen_random_uuid(),
  earthquake_event_id uuid not null references earthquake_events (id) on delete cascade,
  road_id text not null,
  impact_level text not null check (impact_level in ('LOW', 'MODERATE', 'HIGH')),
  confirmed_blocked boolean not null default false,
  notes text,
  verified_at timestamptz not null default now(),
  verified_by uuid references profiles (id)
);

create index if not exists earthquake_road_impacts_road_id_idx on earthquake_road_impacts (road_id);

alter table earthquake_events enable row level security;
alter table earthquake_road_impacts enable row level security;

create policy "earthquake_events_public_read"
  on earthquake_events for select
  using (true);

create policy "earthquake_road_impacts_public_read"
  on earthquake_road_impacts for select
  using (true);

-- Ingesting raw events is a backend/service-role job (the fetch script),
-- not something any authenticated end-user role does — only the review
-- step (earthquake_road_impacts) is SUPER_ADMIN-writable here.
create policy "earthquake_events_superadmin_update"
  on earthquake_events for update
  to authenticated
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );

create policy "earthquake_road_impacts_superadmin_write"
  on earthquake_road_impacts for insert
  to authenticated
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );

create policy "earthquake_road_impacts_superadmin_update"
  on earthquake_road_impacts for update
  to authenticated
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );

create policy "earthquake_road_impacts_superadmin_delete"
  on earthquake_road_impacts for delete
  to authenticated
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );

create trigger earthquake_events_set_updated_at
  before update on earthquake_events
  for each row execute function set_updated_at();
