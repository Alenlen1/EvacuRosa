-- Operator-verified debris footprints. Existing whole-road impacts stay intact.
begin;

alter table public.earthquake_road_impacts
  add column if not exists impact_area jsonb,
  add column if not exists affected_edge_ids text[],
  add column if not exists edge_ranges jsonb;

alter table public.earthquake_road_impacts
  add constraint earthquake_impact_section_nonempty check (
    (impact_area is null and edge_ranges is null and affected_edge_ids is null)
    or (
      impact_area is not null and jsonb_typeof(impact_area) = 'object'
      and impact_area ?& array['latitude', 'longitude', 'radiusMeters']
      and jsonb_typeof(impact_area->'latitude') = 'number'
      and jsonb_typeof(impact_area->'longitude') = 'number'
      and jsonb_typeof(impact_area->'radiusMeters') = 'number'
      and (impact_area->>'radiusMeters')::numeric between 5 and 250
      and edge_ranges is not null and jsonb_typeof(edge_ranges) = 'array'
      and jsonb_array_length(edge_ranges) > 0
      and affected_edge_ids is not null and cardinality(affected_edge_ids) > 0
    )
  );

comment on column public.earthquake_road_impacts.impact_area is
  'CDRRMO-verified debris footprint, not an earthquake epicentre or predicted damage radius. Only selected road intervals affect routing.';
-- Existing SUPER_ADMIN policies and verified_at timestamps are unchanged.
commit;
