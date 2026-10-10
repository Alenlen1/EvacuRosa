# Mobile usability review — 2026-10-10

Browser checks used Edge/Chromium with touch emulation and simulated GPS/API
responses. These results are not physical Android or iPhone certification.

| Scenario                                   | Result                                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Filipino navigation at 320×740 and 390×844 | Passed: four transport choices visible; controls above the details panel                                                                     |
| Filipino landscape at 740×390              | Passed: map, transport choices and navigation controls accessible                                                                            |
| 200% text at 320×740                       | Found overlapping transport labels and crowded header; fixed text wrapping and header sizing; repeat check found no transport-label overflow |
| GPS accuracy degrades to 120 m             | Warning shown; inaccurate fix does not trigger arrival                                                                                       |
| GPS recovers to 5 m                        | Warning clears after a fresh accepted update                                                                                                 |
| Connection lost during an existing route   | Navigation remains active and accepts subsequent GPS updates                                                                                 |
| Prepared app reopened offline              | Service-worker-cached app shell loads; missing offline routing data is disclosed                                                             |

Frontend suite: 104 tests passed, including offline engine/cache tests.
Production build passed. Browser checks reported no page errors.

## Physical-device follow-up

Use Android Chrome and iPhone Safari over HTTPS. Record device, OS, browser,
text setting, and whether the app is installed or running in a browser tab.

1. Set the OS text size to its largest setting and browser text/page zoom to
   200%. Check English and Filipino; all labels, menu, Recenter, transport
   choices and full details must remain readable and reachable.
2. Rotate portrait/landscape with browser bars expanded/collapsed. Open the
   legend and details; check scrolling, close controls and safe-area insets.
3. Deny location, retry after allowing it, and walk into an area with weak GPS.
   Confirm the warning, no false arrival, and recovery without reloading.
4. Check compass permission, heading rotation, manual pan/zoom and Recenter.
5. Download offline maps/routes while online. Enable airplane mode, reopen
   the app, calculate a new route, and inspect map streets at zoom 17–19.
   Repeat without downloaded data: the app must disclose unavailable routing.
6. Confirm cached hazard information is marked as potentially outdated.
7. Check VoiceOver/TalkBack, one-handed tapping and outdoor readability.

Detailed offline-map downloads, actual GPS/compass readings, OS text scaling,
screen readers, and outdoor readability remain pending physical-device checks.
