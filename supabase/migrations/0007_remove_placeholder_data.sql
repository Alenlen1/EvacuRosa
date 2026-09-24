-- Remove evacuation-center rows created by the former development seed.
-- The names are matched exactly so verified operational records are untouched.
delete from evacuation_centers
where name in (
  'SAMPLE — placeholder shelter near Tagapo',
  'SAMPLE — placeholder shelter near Market Area',
  'SAMPLE — placeholder shelter near Pulong Santa Cruz',
  'SAMPLE — placeholder shelter near Balibago',
  'SAMPLE — placeholder shelter near Dita',
  'SAMPLE — placeholder shelter near Caingin'
);
