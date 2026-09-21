/**
 * Approximate operational boundary for Santa Rosa City, Laguna, Philippines.
 *
 * Derived from the city's public center coordinates (14.3146°N, 121.1137°E —
 * OpenStreetMap node 198503203 / Wikidata Q76010) plus its total land area
 * (~54.84 km², the PSA-recognized congressional-district figure covering all
 * 18 barangays), padded into a bounding box with margin.
 *
 * This is a rectangular approximation for the map viewport and routing
 * constraints — not the official cadastral boundary. Replace with a real
 * SANTA_ROSA_CITY_BOUNDARY.geojson (e.g. from PhilGIS or the PSA) once the
 * road-graph phase needs precise polygon containment.
 */

export const SANTA_ROSA_CITY_CENTER: [number, number] = [14.3146, 121.1137];

export const SANTA_ROSA_CITY_BOUNDS: [[number, number], [number, number]] = [
  [14.27, 121.05], // southwest
  [14.36, 121.15], // northeast
];

export const SANTA_ROSA_CITY_DEFAULT_ZOOM = 13;
