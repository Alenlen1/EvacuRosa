-- Offer explicit permanent deletion alongside archival for active hazards.
begin;
create index hazard_archives_original_idx on public.hazard_archives(hazard_type, original_id);
create function public.delete_active_hazard(p_kind text, p_id uuid, p_confirmed boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_table text; locked_id uuid; prior_archives uuid[]; removed integer;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and role = 'SUPER_ADMIN') then
    raise exception 'CDRRMO access required' using errcode = '42501';
  end if;
  if p_confirmed is distinct from true then
    raise exception 'Explicit deletion confirmation required' using errcode = '22023';
  end if;
  target_table := case p_kind when 'flood' then 'flood_reports'
    when 'fire' then 'fire_incidents' when 'impact' then 'earthquake_road_impacts' end;
  if target_table is null then raise exception 'Invalid hazard type' using errcode = '22023'; end if;
  -- Serialize against another archive/delete of this report. Never remove older
  -- archived snapshots that happen to reference the same original ID.
  execute format('select id from public.%I where id = $1 for update', target_table)
    into locked_id using p_id;
  if locked_id is null then return false; end if;
  prior_archives := array(select id from public.hazard_archives where hazard_type = p_kind and original_id = p_id);
  perform public.archive_hazard(p_kind, p_id);
  delete from public.hazard_archives
    where hazard_type = p_kind and original_id = p_id and id <> all(prior_archives);
  get diagnostics removed = row_count;
  if removed <> 1 then
    raise exception 'Could not confirm permanent hazard deletion';
  end if;
  -- The delete trigger and archive cleanup share this transaction. Any failure
  -- rolls back removal of the active report; no partial success is committed.
  return true;
end $$;
revoke all on function public.delete_active_hazard(text, uuid, boolean) from public, anon;
grant execute on function public.delete_active_hazard(text, uuid, boolean) to authenticated;
commit;
