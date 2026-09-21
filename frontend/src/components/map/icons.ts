import L from "leaflet";

/** Builds a Leaflet divIcon from inline SVG/HTML, sidestepping the classic
 * Leaflet + bundler broken-default-marker-image problem entirely. */
export function createDivIcon(html: string, size: number) {
  return L.divIcon({
    html,
    className: "evacurosa-map-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
