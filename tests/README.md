# Tests

Run the frontend and backend suites from the repository root:

```powershell
npm test --workspace=frontend
npm test --workspace=backend
```

The suites cover A* routing, fuzzy inference, hazard rules, evacuation-center
ranking, authorization, and offline caching.

See [evacuation navigation checks](NAVIGATION.md) for camera behavior, GPS and
compass filtering, route progress, and mobile device acceptance checks.

## Route restoration after refresh

`frontend/src/lib/routeSession.test.ts` covers session serialization, validation,
privacy filtering, clearing and unavailable browser storage. Browser acceptance:

1. Select a destination and calculate a route in any travel mode. Refresh the
   same tab: the pin/mode should return, with a new calculation after location
   access is active. No old line, ETA or risk assessment should be restored.
2. Refresh offline or deny location access: show the saved pin and a waiting
   message. Reconnect/enable location to calculate once, not on every GPS update.
3. Change mode while waiting: calculate with the new mode. Choose a different
   destination or remove it while waiting: cancel the automatic restoration.
4. Remove the destination and refresh: it must not come back. A pin that was
   never routed should restore without automatically starting a route search.
5. Repeat with Find evacuation center: search again using current availability;
   the resulting destination pin must match the newly recommended center.
6. Session storage must contain only destination, mode, intent and schema version,
   never origin coordinates, route geometry, risk results or assistance consent.
   Storage is scoped to the tab session (browser session recovery can retain it).
