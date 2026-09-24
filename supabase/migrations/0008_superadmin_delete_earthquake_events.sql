-- Let CDRRMO remove an earthquake event. Its verified road impacts are
-- removed by the event's ON DELETE CASCADE foreign key.
create policy "earthquake_events_superadmin_delete"
  on earthquake_events for delete
  to authenticated
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN')
  );
