-- Add drag-drawn rectangles while retaining existing circular debris records.
-- Road intervals are still recomputed on the backend and explicitly confirmed.
begin;

alter table public.earthquake_road_impacts
  drop constraint earthquake_impact_section_nonempty;

alter table public.earthquake_road_impacts
  add constraint earthquake_impact_section_nonempty check (
    (impact_area is null and edge_ranges is null and affected_edge_ids is null)
    or coalesce((
      impact_area is not null and jsonb_typeof(impact_area) = 'object'
      and impact_area ?& array['latitude', 'longitude']
      and jsonb_typeof(impact_area->'latitude') = 'number'
      and jsonb_typeof(impact_area->'longitude') = 'number'
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
      and edge_ranges is not null and jsonb_typeof(edge_ranges) = 'array'
      and jsonb_array_length(edge_ranges) > 0
      and affected_edge_ids is not null and cardinality(affected_edge_ids) > 0
    ), false)
  );

comment on column public.earthquake_road_impacts.impact_area is
  'Verified debris footprint: legacy circle (radiusMeters) or rectangle (shape, widthMeters, heightMeters) centered at latitude/longitude. Only explicitly confirmed road intervals affect routing.';
commit;
