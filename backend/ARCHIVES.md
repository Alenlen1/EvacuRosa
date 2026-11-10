# CDRRMO archives

Apply `supabase/migrations/0025_cdrrmo_hazard_archives.sql` after the existing
migrations, including `0024`, before deploying the updated backend and admin
frontend. Also apply `0026_delete_hazard_archives.sql` after `0025` to enable
permanent deletion from the hazard archive. If `0025` is already applied, run only
the new pending migrations. `0027_delete_active_hazards.sql` adds permanent
deletion beside Archive in active flood, fire and earthquake records.
Use the Supabase migration workflow or run each new migration in the
SQL Editor. No new environment variables are needed. This change does not apply
the migration to your hosted database automatically.

## Shared locations

The Active requests tab contains submitted, acknowledged and dispatched
requests. Cancelled and completed requests move automatically to the Archive
tab. Their reported locations and status history remain available for review.
Archived requests cannot be reopened or dispatched from that tab. CDRRMO can
confirm **Delete permanently** to remove a closed request, its location/contact
details and cascading status history. The backend rejects unconfirmed deletion
and deletion of an active request. Deleted requests cannot be tracked afterward.
Public request
submission, cancellation and tracking behavior are unchanged.

Both tabs paginate at 100 records and receive automatic updates. Historical
closed requests already in the database are included. Existing privacy retention
still applies: `purge_expired_assistance()` removes closed requests after 30 days
and other requests after 90 days when an operator schedules/runs that cleanup.
Archiving does not disable or extend this retention policy.

## Hazards

Archiving a flood, fire or earthquake report removes its active row and privately
preserves its original fields, ID, dates and geometry in `hazard_archives`.
Database delete triggers make preservation and removal atomic, including deletions
by older clients. If preservation fails, removal rolls back. Archived hazards
are excluded from public data and routing. Existing realtime notifications on
the original hazard tables continue to refresh public data.

The Hazard management Archive tab offers 50 records per page. CDRRMO must
confirm restoration after reviewing current conditions. Restoring reinserts the
saved record, republishes its saved status and road restrictions, and removes
the archive in one transaction. Duplicate IDs and missing linked records leave
the archive intact. For legacy earthquake reports linked to an event, restore
that event before its road impacts. No automatic hazard archive expiry is added.

Only SUPER_ADMIN can read hazard archives or use the archive/restore functions.
The backend uses the staff JWT. Barangay and public accounts cannot read these
snapshots or restore them; clients cannot directly edit/delete archive rows.
The **Delete permanently** action requires a confirmation modal and uses a
separate SUPER_ADMIN-only function with explicit confirmation. It removes only
the selected archived snapshot and cannot be undone. Current active hazards and
routes are unaffected. Concurrent restore/delete actions cannot both succeed;
the second action reports the archive is no longer available.

Active hazard records offer separate **Archive** and **Delete** actions. The
latter requires confirmation and migration `0027`. It permanently removes only
the selected active report and the snapshot generated during that transaction;
older archived snapshots are preserved. Archive is the reversible choice.
Either action removes the report's current routing restrictions. Transaction
failures preserve the active report. Permanent deletion is individual, not bulk.

Hazards permanently deleted before this migration cannot be recovered by it.
Never rerun old migrations or insert placeholder hazards to recover those rows.

## Verification

Check with test records: archive each hazard type, confirm disappearance from
active/public results, restore it and compare its original geometry and dates.
Cancel or complete a request and verify it moves to Archive with history intact.
Also verify failure/conflict handling and access using barangay/anonymous tokens.
Database transaction and RLS checks should run against an isolated test database.
