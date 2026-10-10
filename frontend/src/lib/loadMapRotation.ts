"use client";
let loading: Promise<unknown> | null = null;
export function loadMapRotation() {
  return (loading ??= (async () => {
    const leaflet = await import("leaflet");
    window.L = leaflet;
    await import("leaflet-rotate/dist/leaflet-rotate.js");
    leaflet.Map.mergeOptions({
      rotateControl: false,
      touchRotate: false,
      shiftKeyRotate: false,
      compassBearing: false,
    });
  })());
}
