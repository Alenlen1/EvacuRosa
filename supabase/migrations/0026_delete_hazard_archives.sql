-- Permanent deletion applies only to archived hazards, never active reports.
begin;
create function public.delete_hazard_archive(p_archive_id uuid, p_confirmed boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and role = 'SUPER_ADMIN') then
    raise exception 'CDRRMO access required' using errcode = '42501';
  end if;
  if p_confirmed is distinct from true then
    raise exception 'Explicit deletion confirmation required' using errcode = '22023';
  end if;
  delete from public.hazard_archives where id = p_archive_id;
  get diagnostics removed = row_count;
  return removed > 0;
end $$;
revoke all on function public.delete_hazard_archive(uuid, boolean) from public, anon;
grant execute on function public.delete_hazard_archive(uuid, boolean) to authenticated;
commit;
