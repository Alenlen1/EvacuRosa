# Evacuation navigation

Select a shelter, use it as the destination and calculate a route (or use
**Find evacuation center**), then select **Start Navigation** on the map.
Navigation is not automatically restarted after a reload.

The existing GPS watcher is reused. Navigation adds compass listeners only
while active and removes them on stop/arrival. Compass access is requested from
the Start button gesture; denied or missing sensors fall back to GPS movement
direction. Without either, the camera stays north-up and the marker is a dot.
Compass readings are approximate: the app does not apply magnetic declination
correction. Device sensors need an on-device HTTPS test.

The Leaflet rotation extension is loaded before creating the public map. Other
maps keep rotation disabled. Online tiles support zoom 19; the saved vector map
can overzoom its available source data up to 19 without adding street detail.

Camera behavior:

- Start at zoom 18 (19 when already close to the destination).
- Place the user below the center of the usable map, accounting for the HUD.
- Dampen position and shortest-path heading changes; use route geometry to
  lead into upcoming bends, not to invent street-level turn instructions.
- Pan, pinch, wheel or zoom controls pause camera following and auto zoom.
- Recenter restores following and an appropriate navigation zoom.
- Apply the close-up destination zoom once per approach, not on every fix.
- Stop/arrival restores north-up and the map center/zoom saved before starting.

Route progress is measured along the polyline. Matching is bounded by previous
progress and elapsed time to prevent skipping loops or crossing roads. Fixes
older than 15 seconds, accuracy worse than 40 m, duplicate timestamps and
implausible jumps are ignored. Three off-route fixes trigger recalculation to
the same shelter through the existing online/offline routing client, with a
30-second retry cooldown. Failed recalculation is shown explicitly. Arrival
requires accurate fixes within 20 m of the shelter, at most 30 m of route left,
and separate observations spanning at least three seconds.

## Verification

`npm.cmd run test --workspace=frontend` includes route projection, loop/crossing
protection, duplicate vertices, bend detection, GPS filtering and heading wrap
tests in `src/lib/navigation.test.ts`.

Browser acceptance checks (simulated GPS first, then real Android/iOS):

1. Start a shelter route. Check zoom 18, the remaining route and directional
   marker. Rotate across 359/0 degrees; check there is no full-circle spin.
2. Drag and zoom manually, then send GPS fixes. The chosen view must stay put.
   Recenter must resume tracking; north-up must preserve a zero map bearing.
3. Walk around a bend. Completed segments disappear, remaining distance falls,
   and the upcoming path stays visible without repeatedly changing zoom.
4. Approach within 70 m, then move slightly away. Close-up zoom should not toggle
   repeatedly. Verify actual tile rendering at zoom 19, including saved maps.
5. Send inaccurate, stale or implausibly distant fixes. Progress and camera
   freeze with a GPS message; these fixes must not cause arrival or rerouting.
6. Move off route for multiple fixes. Check one request to the same shelter,
   updated route/risk details, failed-request feedback and retry cooldown.
   Stop or change destination while a request is pending: ignore its result.
7. Reach the shelter with repeated accurate fixes. Check the arrival message,
   camera restoration and removal of sensor listeners. Repeat manual Stop.
8. Deny orientation permission and test a device without sensors; navigation
   must still follow GPS. Test permission denial/expiry for GPS separately.
9. Check 320 px phones, landscape and desktop; retain the planning actions,
   center supplies, hazard layers, search, language controls and emergency menu.
10. Select a destination that is not a shelter, use Find safer route, then
    Start Navigation. Verify GPS following, rerouting to that destination and
    the generic destination arrival message.
11. Hide navigation controls, verify guidance continues, then show them again
    and check Recenter and Stop. Repeat with Filipino selected.
12. With a rotated map, zoom repeatedly between 14 and 19. The yellow route
    must retain its road vertices and align with the basemap at each zoom.
    Check alignment during the gesture, not only after zoom settles. Repeat
    with two-finger pinch in/out and zoom buttons, before and during navigation.
    Pinch must not change the bearing; compass heading still rotates the map
    while following. Button zooms intentionally skip CSS zoom animation to
    avoid the rotation plugin's vector drift during transitions.

References: [Leaflet rotation extension](https://github.com/Raruto/leaflet-rotate)
and [device orientation permission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static).
