-- Private, explicitly consented location snapshots. Not a dispatch system.
create table public.assistance_requests (
  id uuid primary key,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision not null check (accuracy_meters between 0 and 100000),
  location_recorded_at timestamptz not null,
  display_name text check (char_length(display_name) <= 100),
  contact_number text check (char_length(contact_number) <= 40),
  travel_mode text not null check (travel_mode in ('walking', 'biking', 'motorcycle', 'car')),
  route_kind text not null check (route_kind in ('route', 'evacuation')),
  destination_latitude double precision check (destination_latitude between -90 and 90),
  destination_longitude double precision check (destination_longitude between -180 and 180),
  reason text not null default 'HAZARD_BLOCKED' check (reason = 'HAZARD_BLOCKED'),
  consent_version text not null check (consent_version = 'location-sharing-v1'),
  created_at timestamptz not null default now(),
  check ((route_kind = 'route' and destination_latitude is not null and destination_longitude is not null)
    or (route_kind = 'evacuation' and destination_latitude is null and destination_longitude is null))
);
create index assistance_requests_created_idx on public.assistance_requests (created_at desc);
alter table public.assistance_requests enable row level security;
revoke all on public.assistance_requests from public, anon, authenticated;
grant select on public.assistance_requests to authenticated;
grant select, insert, delete on public.assistance_requests to service_role;
create policy assistance_requests_cdrrmo_read on public.assistance_requests
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );
-- Anonymous clients cannot insert directly. The backend validates consent,
-- freshness, throttles requests and rechecks hazard-blocked routing first.
