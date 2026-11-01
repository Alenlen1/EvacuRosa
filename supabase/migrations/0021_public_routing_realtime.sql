-- Publish only existing public hazard/shelter tables. RLS and grants are unchanged.
begin;
do $$
declare target text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach target in array array[
      'flood_reports', 'fire_incidents', 'earthquake_events',
      'earthquake_road_impacts', 'evacuation_centers'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public'
          and tablename = target
      ) then
        execute format('alter publication supabase_realtime add table public.%I', target);
      end if;
    end loop;
  end if;
end $$;
commit;
