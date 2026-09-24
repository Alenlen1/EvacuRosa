-- Reference data and the Market Area Barangay Hall / Multi-Purpose Complex centers.
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

-- Requested evacuation center; configured capacity is 500, not arena seating capacity.
-- Location: https://www.wikidata.org/wiki/Q55632540
-- Barangay: https://maps.apple.com/place?place-id=I9868CE371D967786
-- Confirm the entrance, operational availability and evacuation capacity with CDRRMO.
insert into barangays (name) values ('Tagapo')
on conflict (name) do nothing;

insert into evacuation_centers (
  barangay_id, name, address, latitude, longitude,
  capacity, current_occupancy, status, notes
)
select
  b.id,
  'City of Santa Rosa Multi-Purpose Complex',
  'Barangay Tagapo, Santa Rosa City, Laguna 4026',
  14.311917,
  121.104778,
  500,
  0,
  'AVAILABLE',
  'Also known as Santa Rosa Sports Complex. Configured evacuation capacity: 500, supplied by the project owner; confirm operational availability, entrance and capacity with CDRRMO.'
from barangays b
where b.name = 'Tagapo'
on conflict (barangay_id, name) do nothing;
