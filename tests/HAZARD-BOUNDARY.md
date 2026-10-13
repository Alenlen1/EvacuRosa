# CDRRMO hazard city boundary

Hazard placement uses the union of **all 18 Santa Rosa, Laguna barangay polygons**, from the [2023 high-resolution Philippines JSON Maps extract](https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/municities/hires/bgysubmuns-municity-403428000.0.1.json). The publisher converts PSA/NAMRIA-derived administrative data. The source, retrieval date, barangay names, PSGC codes and representative points are recorded in `backend/src/data/santaRosaBoundary.json`; the publisher's license is retained in `santaRosaBoundary.LICENSE.txt`. This is an indicative administrative boundary, not a cadastral survey.

The boundary covers Aplaya, Balibago, Caingin, Dila, Dita, Don Jose, Ibaba, Kanluran, Labas, Macabling, Malitlit, Malusak, Market Area, Pooc, Pulong Santa Cruz, Santo Domingo, Sinalhan and Tagapo. Romanville and Richfield are included by the city dataset itself. No hand-drawn subdivision patches or citywide buffers are used. The admin map fits the whole city on initial load rather than opening only around the northern city center. Regression tests verify all 18 barangay names and representative locations, the known subdivisions, and adjacent excluded Biñan locations.

Road fetching derives its coverage from the complete boundary plus a small connection margin, rather than the old northern rectangle. The committed snapshot preserves the original network and adds newly fetched road IDs entirely within the city polygon; `cityCoverageFetchedAt` records their separate date. Fire placement accepts any inside location; flood and earthquake reports still need a mapped eligible road because their records and routing impacts are road-based.

The frontend and backend use the same polygon. Map viewport bounds are only a navigation aid; the polygon determines whether a location is allowed.

- Fire reports require an incident point inside the city. A fire's radius can extend across the border.
- Flood reports and verified earthquake impacts require a road entirely inside the city. Reports apply to a whole road ID, so roads crossing the border are excluded.
- Earthquake events imported from external sources can have epicenters outside Santa Rosa; the restriction applies to manually verified local road impacts.
- Admin road suggestions use `scope=santa-rosa` and only include city roads within 250 meters. Public road lookup and routing keep their existing coverage.
- Existing records are not deleted by this change.

## Verification

Run `npm test --workspace=backend`, `npm test --workspace=frontend`, and both workspace builds. Backend regression tests verify outside, crossing and missing roads are rejected before database writes, inside reports are accepted, and normal road lookups remain available.

In the CDRRMO hazard editor, repeat for Flood, Fire and Earthquake:

1. Click inside Santa Rosa. Fire should show its report form; Flood and Earthquake should suggest only eligible nearby city roads.
2. Click in Biñan or Cabuyao outside the outlined polygon. An error should appear and the pending location and Save button should disappear.
3. Click inside, then immediately outside while roads are loading. The delayed response must not restore the previous selection.
4. Click inside where no eligible road is nearby. Flood and earthquake Save must remain disabled.
5. Check Romanville (14.32664, 121.09821) and Richfield Phase 2 (14.332, 121.100). The location should be accepted. Nearby Biñan locations such as Garcia Filart (14.3245, 121.094647) must be rejected.

Deploy both frontend and backend together so the scoped road lookup and API validation are available.
