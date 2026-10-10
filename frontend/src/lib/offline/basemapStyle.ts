import { namedFlavor } from "@protomaps/basemaps";
import type { Feature, PaintRule } from "protomaps-leaflet";

/** OSM-inspired styling for the downloaded vector map; all assets stay local. */
export function offlineBasemapStyle(
  renderer: typeof import("protomaps-leaflet"),
) {
  const { paintRules, labelRules, LineSymbolizer, PolygonSymbolizer, exp } =
    renderer;
  const palette = {
    ...namedFlavor("light"),
    background: "#f2efe9",
    earth: "#f2efe9",
    water: "#aad3df",
    park_a: "#c8e6ad",
    park_b: "#c8e6ad",
    wood_a: "#add19e",
    wood_b: "#add19e",
    scrub_a: "#d1e5b4",
    scrub_b: "#d1e5b4",
    hospital: "#ffffe5",
    school: "#ffffe5",
    industrial: "#ebdbe8",
    buildings: "#d9d0c9",
    beach: "#fff1ba",
    sand: "#f5e9c6",
    boundaries: "#9f6c9f",
    railway: "#777777",
    ocean_label: "#427d9c",
    roads_label_minor: "#444444",
    roads_label_minor_halo: "#ffffff",
    roads_label_major: "#444444",
    roads_label_major_halo: "#ffffff",
    city_label: "#444444",
    city_label_halo: "#ffffff",
    subplace_label: "#555555",
    subplace_label_halo: "#ffffff",
    landcover: {
      barren: "#eee5d4",
      farmland: "#eef0d5",
      forest: "#add19e",
      glacier: "#ddecec",
      grassland: "#cdebb0",
      scrub: "#d1e5b4",
      urban_area: "#f2efe9",
    },
  };
  const roadKinds = ["other", "path", "minor_road", "major_road", "highway"];
  const specialRoad = (feature: Feature) =>
    ["runway", "taxiway", "pier"].includes(String(feature.props.kind_detail));
  // Keep the default land, water, railway, airport and label rules. Replace the
  // plain white road strokes with separate borders and road-class colors.
  const rules = paintRules(palette).map((rule) => {
    if (rule.dataLayer === "buildings")
      return {
        ...rule,
        minzoom: 14,
        symbolizer: new PolygonSymbolizer({
          fill: palette.buildings,
          stroke: "#bcb3ad",
          width: 0.5,
        }),
      };
    if (rule.dataLayer !== "roads") return rule;
    return {
      ...rule,
      filter: (zoom: number, feature: Feature) =>
        (!roadKinds.includes(String(feature.props.kind)) ||
          specialRoad(feature)) &&
        (rule.filter?.(zoom, feature) ?? true),
    };
  });
  const roadRules: PaintRule[] = [];
  for (const [kind, stops] of [
    [
      "other",
      [
        [14, 0],
        [20, 7],
      ],
    ],
    [
      "minor_road",
      [
        [13, 0],
        [18, 8],
      ],
    ],
    [
      "major_road",
      [
        [6, 0],
        [12, 1.6],
        [15, 4],
        [18, 13],
      ],
    ],
    [
      "highway",
      [
        [3, 0],
        [6, 1.1],
        [12, 1.6],
        [15, 5],
        [18, 15],
      ],
    ],
  ] as const) {
    const width = exp(
      1.6,
      stops.map(([zoom, value]) => [zoom, value]),
    );
    const filter = (_zoom: number, feature: Feature) =>
      feature.props.kind === kind && !specialRoad(feature);
    const color = (_zoom: number, feature?: Feature) => {
      const detail = String(feature?.props.kind_detail);
      if (kind === "highway")
        return detail.startsWith("trunk") ? "#f9b29c" : "#e9a0b0";
      if (kind === "major_road") {
        if (detail.startsWith("primary")) return "#fcd6a4";
        if (detail.startsWith("secondary")) return "#f7fabf";
      }
      return "#ffffff";
    };
    roadRules.push(
      {
        dataLayer: "roads",
        filter,
        symbolizer: new LineSymbolizer({
          color: kind === "highway" ? "#c77f91" : "#bcb8b1",
          width: (zoom) =>
            width(zoom) > 0 ? width(zoom) + (zoom >= 14 ? 1.2 : 0.5) : 0,
        }),
      },
      {
        dataLayer: "roads",
        filter,
        symbolizer: new LineSymbolizer({ color, width }),
      },
    );
  }
  roadRules.push({
    dataLayer: "roads",
    minzoom: 14,
    filter: (_zoom, feature) =>
      feature.props.kind === "path" && !specialRoad(feature),
    symbolizer: new LineSymbolizer({
      color: "#b3947a",
      width: 1,
      dash: [3, 3],
      dashWidth: 1,
    }),
  });
  const boundaries = rules.findIndex((rule) => rule.dataLayer === "boundaries");
  rules.splice(boundaries < 0 ? rules.length : boundaries, 0, ...roadRules);
  return {
    paintRules: rules,
    labelRules: labelRules(palette, "en"),
    backgroundColor: palette.background,
  };
}
