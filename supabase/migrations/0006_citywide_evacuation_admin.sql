-- Lets a BARANGAY_ADMIN optionally manage evacuation centers city-wide
-- instead of just one barangay, without adding a new role: barangay_id =
-- NULL means "not scoped to a single barangay" (citywide evacuation
-- admin); barangay_id = <uuid> keeps the original single-barangay
-- scoping. Either way, this role still cannot touch flood/fire/earthquake
-- data — those policies check role = 'SUPER_ADMIN' specifically and are
-- unaffected by this change.

drop policy if exists "evacuation_centers_admin_update" on evacuation_centers;

create policy "evacuation_centers_admin_update"
  on evacuation_centers for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and (
          p.role = 'SUPER_ADMIN'
          or (
            p.role = 'BARANGAY_ADMIN'
            and (p.barangay_id is null or p.barangay_id = evacuation_centers.barangay_id)
          )
        )
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and (
          p.role = 'SUPER_ADMIN'
          or (
            p.role = 'BARANGAY_ADMIN'
            and (p.barangay_id is null or p.barangay_id = evacuation_centers.barangay_id)
          )
        )
    )
  );
