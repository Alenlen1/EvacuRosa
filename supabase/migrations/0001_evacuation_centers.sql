-- EvacuRosa: barangays, profiles, evacuation_centers, and RLS policies.
-- Run this in the Supabase SQL editor (or via `supabase db push`) once a
-- project exists. Without a configured project, public data endpoints
-- return empty collections and administrative features remain unavailable.

create extension if not exists "pgcrypto";

create table if not exists barangays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default 'Santa Rosa',
  province text not null default 'Laguna',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per admin user, linked to Supabase's own auth.users table.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('BARANGAY_ADMIN', 'SUPER_ADMIN')),
  barangay_id uuid references barangays (id),
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists evacuation_centers (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid references barangays (id),
  name text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  capacity integer not null check (capacity >= 0),
  current_occupancy integer not null default 0 check (current_occupancy >= 0),
  status text not null default 'AVAILABLE'
    check (status in ('AVAILABLE', 'NEARLY_FULL', 'FULL', 'CLOSED')),
  contact_information text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id)
);

create index if not exists evacuation_centers_barangay_id_idx
  on evacuation_centers (barangay_id);

-- Row Level Security: this is the real enforcement backstop, independent
-- of whatever the backend's own authorization code does or doesn't catch.
alter table barangays enable row level security;
alter table profiles enable row level security;
alter table evacuation_centers enable row level security;

create policy "barangays_public_read"
  on barangays for select
  using (true);

create policy "evacuation_centers_public_read"
  on evacuation_centers for select
  using (true);

create policy "profiles_self_read"
  on profiles for select
  to authenticated
  using (id = auth.uid());

-- A barangay admin may only update centers in their own barangay; a super
-- admin may update any. Enforced here, not just in application code.
create policy "evacuation_centers_admin_update"
  on evacuation_centers for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and (
          p.role = 'SUPER_ADMIN'
          or (p.role = 'BARANGAY_ADMIN' and p.barangay_id = evacuation_centers.barangay_id)
        )
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and (
          p.role = 'SUPER_ADMIN'
          or (p.role = 'BARANGAY_ADMIN' and p.barangay_id = evacuation_centers.barangay_id)
        )
    )
  );

create policy "evacuation_centers_superadmin_write"
  on evacuation_centers for insert
  to authenticated
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger evacuation_centers_set_updated_at
  before update on evacuation_centers
  for each row execute function set_updated_at();
