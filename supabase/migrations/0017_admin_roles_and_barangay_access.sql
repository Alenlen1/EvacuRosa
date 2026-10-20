begin;

insert into public.barangays(name) values
('Aplaya'),('Balibago'),('Caingin'),('Dila'),('Dita'),('Don Jose'),('Ibaba'),
('Kanluran'),('Labas'),('Macabling'),('Malitlit'),('Malusak'),('Market Area (Poblacion)'),
('Pooc'),('Pulong Santa Cruz'),('Santo Domingo'),('Sinalhan'),('Tagapo')
on conflict(name) do nothing;

-- Existing unassigned barangay accounts are retained, but denied access by
-- the policies and API until the system operator assigns them explicitly.
alter table public.profiles add constraint barangay_admin_requires_assignment
check (role <> 'BARANGAY_ADMIN' or barangay_id is not null) not valid;

create table public.barangay_access_accounts (
  barangay_id uuid primary key references public.barangays(id),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.barangay_access_accounts enable row level security;
revoke all on public.barangay_access_accounts from public, anon, authenticated;
grant all on public.barangay_access_accounts to service_role;
revoke insert, update, delete on public.profiles from anon, authenticated;

drop policy if exists evacuation_centers_admin_update on public.evacuation_centers;
drop policy if exists evacuation_centers_barangay_admin_update on public.evacuation_centers;
drop policy if exists evacuation_centers_superadmin_write on public.evacuation_centers;

create policy centers_authorized_update on public.evacuation_centers for update to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and
 (p.role = 'SUPER_ADMIN' or (p.role = 'BARANGAY_ADMIN' and p.barangay_id is not null and p.barangay_id = evacuation_centers.barangay_id))))
with check (exists(select 1 from public.profiles p where p.id = auth.uid() and
 (p.role = 'SUPER_ADMIN' or (p.role = 'BARANGAY_ADMIN' and p.barangay_id is not null and p.barangay_id = evacuation_centers.barangay_id))));

create policy centers_cdrrmo_insert on public.evacuation_centers for insert to authenticated
with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN'));
create policy centers_cdrrmo_delete on public.evacuation_centers for delete to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN'));

-- RLS scopes rows; this trigger additionally protects columns even for direct
-- Supabase REST calls that bypass the application frontend/backend.
create function public.guard_center_operations() returns trigger language plpgsql
set search_path = public as $$
declare caller_role text; caller_barangay uuid;
begin
  if auth.uid() is not null then
    select role, barangay_id into caller_role, caller_barangay from public.profiles where id = auth.uid();
    if caller_role = 'BARANGAY_ADMIN' then
      if tg_op <> 'UPDATE' then raise exception 'Barangay accounts may only update occupancy and availability'; end if;
      if caller_barangay is null or old.barangay_id is distinct from caller_barangay or new.barangay_id is distinct from caller_barangay then
        raise exception 'Center is outside the assigned barangay';
      end if;
      if (to_jsonb(new) - array['current_occupancy','status','updated_at','updated_by']) is distinct from
         (to_jsonb(old) - array['current_occupancy','status','updated_at','updated_by']) then
        raise exception 'Barangay accounts may only update occupancy and availability';
      end if;
    elsif caller_role is distinct from 'SUPER_ADMIN' then
      raise exception 'Authorized admin profile required';
    end if;
    new.updated_by = auth.uid();
  end if;
  if new.current_occupancy < 0 or new.capacity < 0 or new.current_occupancy > new.capacity then
    raise exception 'Occupancy must be between zero and capacity';
  end if;
  if new.status = 'CLOSED' or new.capacity = 0 then new.status = 'CLOSED';
  elsif new.current_occupancy::numeric / new.capacity >= 0.9 then new.status = 'FULL';
  elsif new.current_occupancy::numeric / new.capacity >= 0.7 then new.status = 'NEARLY_FULL';
  else new.status = 'AVAILABLE'; end if;
  return new;
end;
$$;
create trigger guard_center_operations before insert or update on public.evacuation_centers
for each row execute function public.guard_center_operations();

-- Public center details deliberately remain readable for evacuation guidance.
-- Account credentials and private administrative data are never public.
commit;
