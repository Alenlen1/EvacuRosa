import { namedFlavor } from "@protomaps/basemaps";
import type { Feature, PaintRule } from "protomaps-leaflet";

/** OSM-inspired styling for the downloaded vector map; all assets stay local. */
export function offlineBasemapStyle(renderer: typeof import("protomaps-leaflet"), dark = false) {
  const { paintRules, labelRules, LineSymbolizer, PolygonSymbolizer, exp } = renderer;
  const lightPalette = {
    ...namedFlavor("light"),
    background: "#f2efe9", earth: "#f2efe9", water: "#aad3df",
    park_a: "#c8e6ad", park_b: "#c8e6ad", wood_a: "#add19e", wood_b: "#add19e",
    scrub_a: "#d1e5b4", scrub_b: "#d1e5b4", hospital: "#ffffe5", school: "#ffffe5",
    industrial: "#ebdbe8", buildings: "#d9d0c9", beach: "#fff1ba", sand: "#f5e9c6",
    boundaries: "#9f6c9f", railway: "#777777", ocean_label: "#427d9c",
    roads_label_minor: "#444444", roads_label_minor_halo: "#ffffff",
    roads_label_major: "#444444", roads_label_major_halo: "#ffffff",
    city_label: "#444444", city_label_halo: "#ffffff",
    subplace_label: "#555555", subplace_label_halo: "#ffffff",
    landcover: {
      barren: "#eee5d4", farmland: "#eef0d5", forest: "#add19e", glacier: "#ddecec",
      grassland: "#cdebb0", scrub: "#d1e5b4", urban_area: "#f2efe9",
    },
  };
  const palette = dark ? {
    ...namedFlavor("dark"),
    background: "#171f29", earth: "#171f29", water: "#17394b",
    park_a: "#263e32", park_b: "#263e32", wood_a: "#243c31", wood_b: "#243c31",
    scrub_a: "#303e32", scrub_b: "#303e32", hospital: "#3d3730", school: "#3d3730",
    industrial: "#37303f", buildings: "#35404c", beach: "#454031", sand: "#454031",
    boundaries: "#9b83ac", railway: "#a9b3c0", ocean_label: "#8cbcd5",
    roads_label_minor: "#dce3eb", roads_label_minor_halo: "#171f29",
    roads_label_major: "#eef2f6", roads_label_major_halo: "#171f29",
    city_label: "#eef2f6", city_label_halo: "#171f29",
    subplace_label: "#c3cddd", subplace_label_halo: "#171f29",
    landcover: {
      barren: "#38372f", farmland: "#333c2e", forest: "#243c31", glacier: "#3b535c",
      grassland: "#303e32", scrub: "#303e32", urban_area: "#171f29",
    },
  } : lightPalette;
  const roadKinds = ["other", "path", "minor_road", "major_road", "highway"];
  const specialRoad = (feature: Feature) => ["runway", "taxiway", "pier"].includes(String(feature.props.kind_detail));
  // Keep the default land, water, railway, airport and label rules. Replace the
  // plain white road strokes with separate borders and road-class colors.
  const rules = paintRules(palette).map(rule => {
    if (rule.dataLayer === "buildings") return {
      ...rule, minzoom: 14,
      symbolizer: new PolygonSymbolizer({ fill: palette.buildings, stroke: dark ? "#495565" : "#bcb3ad", width: 0.5 }),
    };
    if (rule.dataLayer !== "roads") return rule;
    return { ...rule, filter: (zoom: number, feature: Feature) =>
      (!roadKinds.includes(String(feature.props.kind)) || specialRoad(feature)) &&
      (rule.filter?.(zoom, feature) ?? true) };
  });
  const roadRules: PaintRule[] = [];
  for (const [kind, stops] of [
    ["other", [[14, 0], [20, 7]]],
    ["minor_road", [[13, 0], [18, 8]]],
    ["major_road", [[6, 0], [12, 1.6], [15, 4], [18, 13]]],
    ["highway", [[3, 0], [6, 1.1], [12, 1.6], [15, 5], [18, 15]]],
  ] as const) {
    const width = exp(1.6, stops.map(([zoom, value]) => [zoom, value]));
    const filter = (_zoom: number, feature: Feature) => feature.props.kind === kind && !specialRoad(feature);
    const color = (_zoom: number, feature?: Feature) => {
      const detail = String(feature?.props.kind_detail);
      if (kind === "highway") return detail.startsWith("trunk") ? "#f9b29c" : "#e9a0b0";
      if (kind === "major_road") {
        if (detail.startsWith("primary")) return "#fcd6a4";
        if (detail.startsWith("secondary")) return "#f7fabf";
      }
      return dark ? "#647183" : "#ffffff";
    };
    roadRules.push(
      { dataLayer: "roads", filter, symbolizer: new LineSymbolizer({
        color: dark ? "#26313f" : kind === "highway" ? "#c77f91" : "#bcb8b1",
        width: zoom => width(zoom) > 0 ? width(zoom) + (zoom >= 14 ? 1.2 : 0.5) : 0,
      }) },
      { dataLayer: "roads", filter, symbolizer: new LineSymbolizer({ color, width }) },
    );
  }
  roadRules.push({ dataLayer: "roads", minzoom: 14,
    filter: (_zoom, feature) => feature.props.kind === "path" && !specialRoad(feature),
    symbolizer: new LineSymbolizer({ color: "#b3947a", width: 1, dash: [3, 3], dashWidth: 1 }),
  });
  const boundaries = rules.findIndex(rule => rule.dataLayer === "boundaries");
  rules.splice(boundaries < 0 ? rules.length : boundaries, 0, ...roadRules);
  return { paintRules: rules, labelRules: labelRules(palette, "en"), backgroundColor: palette.background };
}
