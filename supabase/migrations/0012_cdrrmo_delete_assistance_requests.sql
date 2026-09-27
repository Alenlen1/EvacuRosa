-- CDRRMO can permanently remove a selected location request after rescue.
-- No delete access for anonymous users or barangay administrators.
grant delete on public.assistance_requests to authenticated;
create policy assistance_requests_cdrrmo_delete on public.assistance_requests
  for delete to authenticated using (
    exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );
