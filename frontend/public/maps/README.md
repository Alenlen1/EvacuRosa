# Santa Rosa offline basemap

`santa-rosa.pmtiles` is a regional extract of the Protomaps basemap, containing
OpenStreetMap-derived streets, buildings, labels, water, and land features.
It is served by this app and saved as a complete file in the browser's IndexedDB.
Rendering uses local file reads, with no external tile, font, or sprite requests.

- Source: https://build.protomaps.com/20261007.pmtiles
- Source map version: 4.15.2
- OSM data timestamp: 2026-10-07T04:00:00Z
- Bounds (west, south, east, north): 121.04, 14.26, 121.16, 14.37
- Native zooms: 0–15, rendered with overzoom through 19
- Size: 4,084,722 bytes

The basemap is an Open Database License Produced Work. Retain OpenStreetMap
attribution in the map and when redistributing this archive. Protomaps source
and distribution details: https://docs.protomaps.com/basemaps/downloads
ODbL: https://opendatacommons.org/licenses/odbl/1-0/

To refresh, download the official `pmtiles` CLI from
https://github.com/protomaps/go-pmtiles/releases and select a current source from
https://maps.protomaps.com/builds/ . Extract the same bounds:

```text
pmtiles extract SOURCE_URL santa-rosa.pmtiles --bbox=121.04,14.26,121.16,14.37 --maxzoom=15
```

Update `manifest.json` with the file's SHA-256, byte length, source URL, source
version, and OSM timestamp. Clients download a new file only when the SHA-256
changes. Keep the archive in the deployment; do not hotlink the planet source.
