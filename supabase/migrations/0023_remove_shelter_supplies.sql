-- Retire shelter-supply tracking. Keep assistance status, history and triggers.
-- Deploy the backend/admin code that no longer reads these columns first.
begin;

drop trigger if exists stamp_shelter_supplies on public.evacuation_centers;
drop function if exists public.stamp_shelter_supplies();

alter table public.evacuation_centers
  drop column if exists water_status,
  drop column if exists food_status,
  drop column if exists medical_status,
  drop column if exists supplies_updated_at;

commit;
