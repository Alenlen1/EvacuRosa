-- Retain removed hazards privately; restoring republishes the original record.
begin;
create table public.hazard_archives (
  id uuid primary key default gen_random_uuid(),
  hazard_type text not null check (hazard_type in ('flood', 'fire', 'impact', 'event')),
  original_id uuid not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  archived_at timestamptz not null default now(),
  archived_by uuid references auth.users(id) on delete set null
);
create index hazard_archives_date_idx on public.hazard_archives(archived_at desc, id desc);
alter table public.hazard_archives enable row level security;
revoke all on public.hazard_archives from anon, authenticated;
grant select on public.hazard_archives to authenticated;
create policy hazard_archives_cdrrmo_read on public.hazard_archives
for select to authenticated using (
  exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'SUPER_ADMIN')
);

-- A trigger makes preservation and removal one atomic database operation,
-- including old clients deleting through the existing Supabase API.
create function public.capture_hazard_archive() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.hazard_archives(hazard_type, original_id, snapshot, archived_by)
  values (tg_argv[0], old.id, to_jsonb(old), auth.uid());
  return old;
end $$;
revoke all on function public.capture_hazard_archive() from public;
create trigger flood_archive_before_delete before delete on public.flood_reports
for each row execute function public.capture_hazard_archive('flood');
create trigger fire_archive_before_delete before delete on public.fire_incidents
for each row execute function public.capture_hazard_archive('fire');
create trigger impact_archive_before_delete before delete on public.earthquake_road_impacts
for each row execute function public.capture_hazard_archive('impact');
create trigger event_archive_before_delete before delete on public.earthquake_events
for each row execute function public.capture_hazard_archive('event');

-- This entry point fails safely if the migration has not been installed.
create function public.archive_hazard(p_kind text, p_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare target_table text; removed integer;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and role = 'SUPER_ADMIN') then
    raise exception 'CDRRMO access required' using errcode = '42501';
  end if;
  target_table := case p_kind when 'flood' then 'flood_reports' when 'fire' then 'fire_incidents'
    when 'impact' then 'earthquake_road_impacts' when 'event' then 'earthquake_events' end;
  if target_table is null then raise exception 'Invalid hazard type' using errcode = '22023'; end if;
  execute format('delete from public.%I where id = $1', target_table) using p_id;
  get diagnostics removed = row_count;
  return removed > 0;
end $$;
revoke all on function public.archive_hazard(text, uuid) from public, anon;
grant execute on function public.archive_hazard(text, uuid) to authenticated;

create function public.restore_hazard(p_archive_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare saved public.hazard_archives; target_table text;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and role = 'SUPER_ADMIN') then
    raise exception 'CDRRMO access required' using errcode = '42501';
  end if;
  select * into saved from public.hazard_archives where id = p_archive_id for update;
  if not found then return false; end if;
  target_table := case saved.hazard_type when 'flood' then 'flood_reports' when 'fire' then 'fire_incidents'
    when 'impact' then 'earthquake_road_impacts' when 'event' then 'earthquake_events' end;
  execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', target_table, target_table)
    using saved.snapshot;
  -- An insert conflict or constraint error rolls back the whole function;
  -- the archive survives and can be reviewed or retried.
  delete from public.hazard_archives where id = p_archive_id;
  return true;
end $$;
revoke all on function public.restore_hazard(uuid) from public, anon;
grant execute on function public.restore_hazard(uuid) to authenticated;
commit;
