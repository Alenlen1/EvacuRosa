# Evacuation center barangay assignment

CDRRMO first selects the assigned barangay, then chooses the verified entrance.
The entrance map and coordinate fields cannot accept a location until a barangay
is selected. The map centers on its polygon at a closer zoom for entrance placement,
outlines it in burgundy, and shades the
surrounding area; panning and zooming remain available for context. Outside clicks
show an explanation and preserve any valid entrance. Typed coordinates outside
the selected barangay cannot be saved. Changing barangay clears an entrance that
does not belong to the new selection, while preserving the other center details.

The backend independently resolves the location on create/update requests, looks
up its barangay record, and rejects a mismatched assignment. Creation requires an
explicit barangay ID. An update without a barangay ID validates against the
existing assignment; moving the entrance never silently reassigns the center.
Barangay occupancy/availability updates retain their existing authorization scope.

Both applications use `src/geography/barangayBoundary.ts` and the 18 local polygons
in `src/data/santaRosaBarangays.json`. The pinned 2023 PSA/NAMRIA-derived dataset
matches the source of the existing city outline; attribution and source details
are in `src/data/santaRosaBoundary.LICENSE.txt`. These are indicative administrative
boundaries, not a cadastral survey. An entrance exactly on a shared boundary is
rejected rather than assigned arbitrarily; select its verified position clearly
inside the correct barangay.

Deploy the updated backend and staff frontend together. No SQL migration or live
geocoding service is required. Existing centers are not bulk-reassigned. Editing
preserves the recorded barangay and entrance; if they disagree, CDRRMO must select
the correct barangay and a verified entrance inside it before saving. Check
questionable entrance positions with CDRRMO before saving.
