-- Informational debris footprints need no road association. Existing selected
-- sections and legacy whole-road reports keep their routing semantics and RLS.
begin;

alter table public.earthquake_road_impacts
  alter column road_id drop not null,
  drop constraint earthquake_impact_section_nonempty;

alter table public.earthquake_road_impacts
  add constraint earthquake_impact_section_nonempty check (
    (road_id is not null and impact_area is null
      and edge_ranges is null and affected_edge_ids is null)
    or coalesce((
      impact_area is not null and jsonb_typeof(impact_area) = 'object'
      and impact_area ?& array['latitude', 'longitude']
      and jsonb_typeof(impact_area->'latitude') = 'number'
      and jsonb_typeof(impact_area->'longitude') = 'number'
      and (impact_area->>'latitude')::numeric between -85 and 85
      and (impact_area->>'longitude')::numeric between -180 and 180
      and (
        (
          (not (impact_area ? 'shape') or impact_area->>'shape' = 'circle')
          and impact_area ? 'radiusMeters'
          and jsonb_typeof(impact_area->'radiusMeters') = 'number'
          and (impact_area->>'radiusMeters')::numeric between 5 and 250
        ) or (
          impact_area->>'shape' = 'rectangle'
          and impact_area ?& array['widthMeters', 'heightMeters']
          and jsonb_typeof(impact_area->'widthMeters') = 'number'
          and jsonb_typeof(impact_area->'heightMeters') = 'number'
          and (impact_area->>'widthMeters')::numeric between 5 and 500
          and (impact_area->>'heightMeters')::numeric between 5 and 500
        )
      )
      and (
        (road_id is not null
          and edge_ranges is not null and jsonb_typeof(edge_ranges) = 'array'
          and jsonb_array_length(edge_ranges) > 0
          and affected_edge_ids is not null and cardinality(affected_edge_ids) > 0)
        or
        (road_id is null and confirmed_blocked = false
          and edge_ranges = '[]'::jsonb and affected_edge_ids = '{}'::text[])
      )
    ), false)
  );

comment on column public.earthquake_road_impacts.road_id is
  'Mapped road ID; NULL is an area-only report that never changes road risk or passability.';
commit;
