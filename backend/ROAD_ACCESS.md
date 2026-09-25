# Travel-mode routing

Both `/api/route` and `/api/evacuation-route` accept `travelMode`:
`walking`, `biking`, `motorcycle`, or `car`. Omitted values default to walking;
invalid values return HTTP 400. Changing the frontend mode clears the previous
route and invalidates pending responses; request a new route to use the new mode.

The graph preserves OSM way order and raw way tags. A* filters each directed
edge by mode before applying existing hazard exclusions and risk costs. This
changes eligibility, not the risk-weighted objective or travel-time assumptions.
All modes still avoid roads marked BLOCKED by any hazard source.

## Supported rules

- `oneway=yes/1/true`, `-1`, and explicit `no/0/false`.
- Implied one-way motorways/motorway links and roundabouts.
- `oneway:vehicle`, `oneway:motor_vehicle`, and mode-specific overrides,
  including `oneway:bicycle=no`. Generic one-way tags do not restrict walking;
  `oneway:foot` does.
- Access precedence: `access` → `vehicle` → `motor_vehicle` → mode-specific
  keys (`foot`, `bicycle`, `motorcycle`, `motorcar`), with forward/backward tags.
- Road-class defaults exclude motor vehicles from pedestrian/cycle paths and
  walking/cycling from motorway/trunk roads unless tags explicitly permit them.
- Private, destination-only, customers-only, unknown access values and unresolved
  conditional rules are excluded. This is a conservative public-through-routing
  policy: even a legitimate destination inside a restricted road may be unreachable.
- Endpoints snap to mode-accessible graph nodes within 250 meters. An inaccessible
  start/destination or disconnected directed route returns a no-route response;
  the system never retries with access or hazard checks disabled.

## Data and deployment

The checked-in snapshot has been refreshed with the new importer. Deploy frontend
and backend together and restart the backend to reload it. No database migration
is needed. To refresh it again:

```sh
npm run fetch:roads --workspace=backend
```

The loader rejects old snapshots that lack access tags. Source:
[OSM access](https://wiki.openstreetmap.org/wiki/Key:access) and
[OSM one-way tagging](https://wiki.openstreetmap.org/wiki/Key:oneway).

## Limits

Local project-owner corrections live in `src/data/localRoadAccess.ts` and are
applied at load time, leaving downloaded OSM tags unchanged. The school/market
service lane `W319098748` is walking-only based on the owner's two supplied pins;
cycling, motorcycles, and cars cannot traverse it in either direction. Adjacent
roads are unchanged. These corrections survive imports while way IDs remain
stable; review them if OSM splits or replaces a way. Restart after editing them.

This is not full legal turn-by-turn navigation. Turn-restriction relations,
node barriers/gates, vehicle dimensions/engine capacity, schedules, and lane-specific
rules are not evaluated. Missing or incorrect OSM tags remain a limitation; follow
posted signs. Generic road defaults are project assumptions, not a complete local
traffic-law model. Motorcycle is a generic profile with no engine-size input.
Off-road connections between a pin and its snapped road node are not access-checked.
Live traffic is not used and times remain fixed-speed estimates. Pedestrian and
cycling paths are included in the import, but only the largest undirected connected
component is retained; reachability can differ by mode and direction.
