begin;

alter table public.evacuation_centers
  add column water_status text not null default 'unknown' check (water_status in ('unknown', 'adequate', 'low', 'unavailable')),
  add column food_status text not null default 'unknown' check (food_status in ('unknown', 'adequate', 'low', 'unavailable')),
  add column medical_status text not null default 'unknown' check (medical_status in ('unknown', 'adequate', 'low', 'unavailable')),
  add column supplies_updated_at timestamptz;

create function public.stamp_shelter_supplies() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Unknown legacy supplies have no verification timestamp.
  if row(new.water_status, new.food_status, new.medical_status) is distinct from
     row(old.water_status, old.food_status, old.medical_status)
     or new.supplies_updated_at is distinct from old.supplies_updated_at then
    new.supplies_updated_at = now();
  end if;
  return new;
end;
$$;
create trigger stamp_shelter_supplies before update on public.evacuation_centers
for each row execute function public.stamp_shelter_supplies();

alter table public.assistance_requests
  add column status text not null default 'NEW' check (status in ('NEW', 'ACKNOWLEDGED', 'RESOLVED')),
  add column status_updated_at timestamptz,
  add column status_updated_by uuid references auth.users(id) on delete set null;

-- Only these columns may be written by authenticated clients. Personal
-- location/contact data remains immutable and inaccessible to the public.
grant update (status) on public.assistance_requests to authenticated;
create policy assistance_requests_cdrrmo_update on public.assistance_requests
for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN'));

create function public.stamp_assistance_status() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if not ((old.status = 'NEW' and new.status = 'ACKNOWLEDGED')
         or (old.status = 'ACKNOWLEDGED' and new.status = 'RESOLVED')) then
      raise exception 'Invalid assistance status transition';
    end if;
    new.status_updated_at = now();
    new.status_updated_by = auth.uid();
  end if;
  return new;
end;
$$;
create trigger stamp_assistance_status before update on public.assistance_requests
for each row execute function public.stamp_assistance_status();
commit;
