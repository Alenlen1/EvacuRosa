-- SAMPLE data only — evacuation center names/capacities/occupancy are
-- placeholders, not real CDRRMO-verified data. Replace before this goes
-- anywhere near production. The barangay list itself IS the real,
-- official list of Santa Rosa City's 18 barangays (source: PSA / Wikipedia).

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

-- A handful of sample centers spread across different barangays — enough
-- to test barangay-scoped admin access (one admin should see only their
-- own barangay's center, not another's).
insert into evacuation_centers
  (barangay_id, name, address, latitude, longitude, capacity, current_occupancy, status, contact_information, notes)
select b.id, v.name, v.address, v.lat, v.lng, v.capacity, v.occupancy, v.status,
       'Placeholder — not a real number',
       'Seed data — replace with a CDRRMO-verified center before real use.'
from (values
  ('Tagapo', 'SAMPLE — placeholder shelter near Tagapo', 'Near Tagapo, Santa Rosa City, Laguna', 14.318, 121.118, 500, 120, 'AVAILABLE'),
  ('Market Area (Poblacion)', 'SAMPLE — placeholder shelter near Market Area', 'Near Market Area, Santa Rosa City, Laguna', 14.3123, 121.1113, 300, 240, 'NEARLY_FULL'),
  ('Pulong Santa Cruz', 'SAMPLE — placeholder shelter near Pulong Santa Cruz', 'Near Pulong Santa Cruz, Santa Rosa City, Laguna', 14.323, 121.105, 200, 200, 'FULL'),
  ('Balibago', 'SAMPLE — placeholder shelter near Balibago', 'Near Balibago, Santa Rosa City, Laguna', 14.3005, 121.125, 400, 0, 'CLOSED'),
  ('Dita', 'SAMPLE — placeholder shelter near Dita', 'Near Dita, Santa Rosa City, Laguna', 14.315, 121.10, 350, 90, 'AVAILABLE'),
  ('Caingin', 'SAMPLE — placeholder shelter near Caingin', 'Near Caingin, Santa Rosa City, Laguna', 14.325, 121.115, 300, 60, 'AVAILABLE')
) as v(barangay_name, name, address, lat, lng, capacity, occupancy, status)
join barangays b on b.name = v.barangay_name
on conflict (barangay_id, name) do nothing;
