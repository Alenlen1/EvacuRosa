-- Reference data only. Evacuation centers and hazards must be entered from
-- verified CDRRMO/barangay sources; this seed intentionally creates none.

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
