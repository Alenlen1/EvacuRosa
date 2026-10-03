-- Keep stored passability consistent, including writes made directly to Supabase.
begin;

create or replace function public.set_flood_severity_passability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.road_impassable := new.severity in ('HIGH', 'SEVERE');
  return new;
end;
$$;

create trigger flood_reports_severity_passability
  before insert or update on public.flood_reports
  for each row execute function public.set_flood_severity_passability();

update public.flood_reports
set road_impassable = severity in ('HIGH', 'SEVERE')
where road_impassable is distinct from (severity in ('HIGH', 'SEVERE'));

commit;
