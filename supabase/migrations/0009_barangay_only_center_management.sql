-- Evacuation-center occupancy management belongs to barangay admins.
-- CDRRMO super admins manage hazard reports, not evacuation centers.
drop policy if exists "evacuation_centers_admin_update" on evacuation_centers;

create policy "evacuation_centers_barangay_admin_update"
  on evacuation_centers for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'BARANGAY_ADMIN'
        and (p.barangay_id is null or p.barangay_id = evacuation_centers.barangay_id)
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'BARANGAY_ADMIN'
        and (p.barangay_id is null or p.barangay_id = evacuation_centers.barangay_id)
    )
  );
