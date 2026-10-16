-- Existing reports keep their original whole-road coverage.
-- A non-null list identifies complete forward graph segments; reverse travel
-- uses the same canonical IDs. Coordinates are resolved by the backend.
alter table public.flood_reports
  add column if not exists affected_edge_ids text[];

alter table public.flood_reports
  add constraint flood_reports_nonempty_section
  check (affected_edge_ids is null or (
    cardinality(affected_edge_ids) > 0
    and array_position(affected_edge_ids, null) is null
  ));
