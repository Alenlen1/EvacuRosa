# Road-network audit — 5 November 2026

The audit reproduced no-route responses with no active hazards. Some are caused
by disconnected map data or access restrictions. A separate starting-point
matching issue also needs correction; not every no-route response is expected.
No routing rules or road data were changed during this audit.

## Coverage

- Loaded the actual backend road graph, including local access corrections:
  61,720 nodes, 70,027 source segments, and 15,728 OpenStreetMap way IDs.
- Checked mode-specific directed connectivity across the entire saved graph.
- Reviewed all 8,672 way IDs with an endpoint or segment midpoint inside Santa
  Rosa. A way ID is a mapped road section, not necessarily a whole named street.
- For each way permitting a travel mode, selected one segment midpoint and
  calculated routes both to and from the fixed reference point
  `14.318960, 121.112070`. This ran 38,030 actual route calculations using the
  backend's endpoint matching, fuzzy weighting, access rules and A*.
- Used an empty hazard snapshot. Private, one-way, mode and static road
  restrictions remained enabled. No Supabase requests or database writes.
- Found no duplicate segment IDs, missing segment endpoints or invalid segment
  lengths in the loaded graph.

| Mode       | Route calculations | Routes found | No route | Way IDs excluded by access/status |
| ---------- | -----------------: | -----------: | -------: | --------------------------------: |
| Walking    |             10,286 |        9,867 |      419 |                             3,529 |
| Cycling    |              9,222 |        7,855 |    1,367 |                             4,061 |
| Motorcycle |              9,290 |        9,014 |      276 |                             4,027 |
| Car        |              9,232 |        8,953 |      279 |                             4,056 |
| Total      |             38,030 |       35,689 |    2,341 |      15,673 mode/way combinations |

The no-route column counts failed direction checks, not distinct streets or
confirmed software defects. A road may work locally within its own network yet
have no permitted connection to the central reference. Excluded way IDs were
classified without trying to route through a forbidden road.

## Reproduced starting-point matching issue

`routing.ts` selects the origin using `nearestAccessibleNode`, while the
destination uses projection onto a nearby road segment. A nearby side-path node
can be closer than either vertex of the road underneath the origin pin.

At the following road midpoints, walking **from the road to the reference**
fails, but walking **from the reference to the same point** succeeds:

| Road ID    | Saved name               |    Latitude |    Longitude |
| ---------- | ------------------------ | ----------: | -----------: |
| W134990071 | service                  | 14.28689540 | 121.10529610 |
| W245023947 | unclassified             | 14.26954655 | 121.08803445 |
| W560518278 | residential              | 14.30351395 | 121.12244735 |
| W663819225 | Santa Rosa-Tagaytay Road | 14.28422660 | 121.08785495 |

For all four cases, the selected origin node cannot reach the reference under
walking rules, while an anchor on the segment underneath the point can. This
confirms a mismatch between origin-node selection and destination-segment
selection, rather than proving that the selected road is physically blocked.

The next code correction should match origins to the actual nearby segment,
preserving direction, partial-segment distances, hazard IDs and access checks.
It must also handle two points on the same segment. Trying arbitrary alternate
origins until a route succeeds could bypass a legitimate closure or restriction.

## Independent map-data and access findings

- The saved graph has **8 structural components**, even before applying mode
  restrictions. The largest contains 60,950 nodes.
- A detached 361-node network includes Leyte Street, Guimaras Street, Lahoy
  Street and nearby residential roads around `14.2484354, 121.1099360`.
  Routes between that network and the reference fail in all modes. Physical
  connecting entrances must be verified before changing the graph.
- A walking network around `14.2889086, 121.1043550` connects outward through
  way `W93704480`, tagged `access=private` in the saved data. The public router
  excludes that connection.
- A Nuvali Boulevard walking network around `14.2264465, 121.0571848` has
  outgoing connections tagged `foot=no` (`W155739590`, `W189679429`) or
  `access=private`. Those tags explain its walking disconnection in this snapshot.
- Other failures differ by mode and direction. Cycling restrictions and one-way
  links contribute; blanket removal of access/one-way checks would be incorrect.

These are findings from the checked-in snapshot, not verification of current
physical access or current OpenStreetMap tags. Its metadata records an original
fetch on 3 October 2026 and a city-coverage addition on 13 October 2026.

## Repeat the audit

From the repository root:

```powershell
npm.cmd run audit:roads --workspace backend
```

This builds the backend and saves ignored local artifacts under
`.runtime/road-network-audit/`:

- `summary.json`: totals, metadata, graph hash and connectivity counts.
- `roads.csv`: every city way/mode, representative coordinates, direction
  results and warnings, including access-excluded roads.
- `failures.json`: failed representative routes with way IDs and OSM links.

The completed audit took approximately 224 seconds on the local development
machine. No-route results are recorded for investigation; only malformed graph
records make the command exit unsuccessfully.

For a shorter diagnostic run after building, pass an output directory and an
optional road limit directly to the script:

```powershell
node backend/scripts/audit-road-network.cjs .runtime/road-audit-small 100
```

## Limits and validation

This covers all saved segments structurally and one representative point per
city way in each permitted mode. It is not every coordinate, every pair of
roads, every evacuation-center assignment, current live hazards, production
performance or a field survey. A successful route is not a safety guarantee.

The backend production build and all **392 backend tests** passed. The audit
adds repeatable diagnostics; it does not yet fix the origin matching issue or
the source network's missing connections.
