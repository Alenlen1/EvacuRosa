-- Run after 0015. Preserve existing whole-road and whole-segment reports.
-- New reports keep fractional start/end positions on the original graph edges.
alter table public.flood_reports
  add column if not exists edge_ranges jsonb;

alter table public.flood_reports
  add constraint flood_reports_nonempty_ranges
  check (edge_ranges is null or (
    jsonb_typeof(edge_ranges) = 'array'
    and jsonb_array_length(edge_ranges) > 0
  ));
