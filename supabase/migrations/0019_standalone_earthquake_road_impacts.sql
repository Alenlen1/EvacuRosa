-- CDRRMO can verify earthquake-related road damage without a feed event.
-- Preserve existing event links, foreign keys, timestamps and role policies.
begin;

alter table public.earthquake_road_impacts
  alter column earthquake_event_id drop not null;

comment on column public.earthquake_road_impacts.earthquake_event_id is
  'Optional source earthquake event. CDRRMO may report a verified road impact directly.';

commit;
