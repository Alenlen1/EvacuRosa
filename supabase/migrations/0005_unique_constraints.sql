-- Fixes a latent bug in seed.sql: barangays.name had no uniqueness
-- constraint, so "ON CONFLICT DO NOTHING" there was silently a no-op —
-- re-running the seed would create duplicate barangay rows instead of
-- skipping them, since there was nothing to conflict on.
alter table barangays add constraint barangays_name_key unique (name);

-- Same issue, same fix, for evacuation_centers: without this, re-running
-- repeated imports could silently duplicate center rows.
alter table evacuation_centers add constraint evacuation_centers_barangay_name_key unique (barangay_id, name);
