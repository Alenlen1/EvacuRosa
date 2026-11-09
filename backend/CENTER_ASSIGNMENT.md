# Evacuation center barangay assignment

The verified entrance determines a center's barangay. The staff form resolves
typed coordinates and map clicks immediately and shows a read-only assignment.
The backend independently resolves the location on CDRRMO create/update requests,
looks up the matching barangay record, and rejects a supplied mismatched ID.
Moving an entrance without supplying an ID assigns its new barangay automatically.
Barangay occupancy/availability updates retain their existing authorization scope.

Both applications use `src/geography/barangayBoundary.ts` and the 18 local polygons
in `src/data/santaRosaBarangays.json`. The pinned 2023 PSA/NAMRIA-derived dataset
matches the source of the existing city outline; attribution and source details
are in `src/data/santaRosaBoundary.LICENSE.txt`. These are indicative administrative
boundaries, not a cadastral survey. An entrance exactly on a shared boundary is
rejected rather than assigned arbitrarily; select its verified position clearly
inside the correct barangay.

Deploy the updated backend and staff frontend together. No SQL migration or live
geocoding service is required. Existing centers are not bulk-reassigned; reviewing
and saving an existing center through the updated CDRRMO form uses its entrance's
resolved barangay. Check questionable entrance positions with CDRRMO before saving.
