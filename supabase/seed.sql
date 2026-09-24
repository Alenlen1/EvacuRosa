-- Reference data and the Market Area Barangay Hall evacuation center.
-- Center location is based on the mapped barangay hall; confirm operational
-- availability/capacity with CDRRMO before relying on it during an emergency.

insert into barangays (name) values
  ('Aplaya'),
  ('Balibago'),
  ('Caingin'),
  ('Dila'),
  ('Dita'),
  ('Don Jose'),
  ('Ibaba'),
  ('Kanluran'),
  ('Labas'),
  ('Macabling'),
  ('Malitlit'),
  ('Malusak'),
  ('Market Area (Poblacion)'),
  ('Pooc'),
  ('Pulong Santa Cruz'),
  ('Santo Domingo'),
  ('Sinalhan'),
  ('Tagapo')
on conflict (name) do nothing;

insert into evacuation_centers (
  barangay_id,
  name,
  address,
  latitude,
  longitude,
  capacity,
  current_occupancy,
  status,
  notes
)
select
  b.id,
  'Market Area Barangay Hall',
  'Tatlong Hari, Santa Rosa, Laguna 4026',
  14.31896,
  121.11207,
  500,
  0,
  'AVAILABLE',
  'Seeded center record; confirm operational details with CDRRMO.'
from barangays b
where b.name = 'Market Area (Poblacion)'
on conflict (barangay_id, name) do nothing;
