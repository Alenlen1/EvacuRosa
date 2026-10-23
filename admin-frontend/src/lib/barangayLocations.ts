export type BarangayLocation = {
  name: string;
  center: [number, number];
  bounds?: [[number, number], [number, number]];
};

/**
 * Area navigation points, not barangay halls or surveyed boundaries.
 * Centers match the verified representative points in backend/src/data/santaRosaBoundary.json.
 * Bounds come from the same published 2023 PSA/NAMRIA-derived barangay polygons:
 * https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/municities/hires/bgysubmuns-municity-403428000.0.1.json
 * Verified 2026-10-23: exactly 18 features with adm3_psgc 403428000 (Santa Rosa, Laguna).
 * Philippines JSON Maps © James Faeldon, MIT; see barangayLocations.LICENSE.txt.
 * Kept local so search never depends on a live geocoding service.
 */
export const BARANGAY_LOCATIONS: readonly BarangayLocation[] = [
  {
    name: "Aplaya",
    center: [14.3177511, 121.1218049],
    bounds: [
      [14.3102016, 121.1160689],
      [14.3247789, 121.1254768],
    ],
  },
  {
    name: "Balibago",
    center: [14.2888036, 121.093398],
    bounds: [
      [14.2774947, 121.0885221],
      [14.2996104, 121.11152],
    ],
  },
  {
    name: "Caingin",
    center: [14.3037312, 121.1252085],
    bounds: [
      [14.2963199, 121.1208338],
      [14.3105071, 121.129898],
    ],
  },
  {
    name: "Dila",
    center: [14.2919421, 121.1165133],
    bounds: [
      [14.2849122, 121.0980006],
      [14.2984556, 121.1283925],
    ],
  },
  {
    name: "Dita",
    center: [14.2796812, 121.1119122],
    bounds: [
      [14.2711926, 121.0913563],
      [14.2881948, 121.1266548],
    ],
  },
  {
    name: "Don Jose",
    center: [14.2533873, 121.0731362],
    bounds: [
      [14.230625, 121.0508434],
      [14.2768116, 121.1142451],
    ],
  },
  {
    name: "Ibaba",
    center: [14.3131795, 121.1179805],
    bounds: [
      [14.3113953, 121.114468],
      [14.3161626, 121.1217145],
    ],
  },
  {
    name: "Labas",
    center: [14.3078533, 121.1086466],
    bounds: [
      [14.3023177, 121.1011124],
      [14.312952, 121.1215703],
    ],
  },
  {
    name: "Macabling",
    center: [14.2999346, 121.0967237],
    bounds: [
      [14.2903147, 121.0881134],
      [14.3093821, 121.1056759],
    ],
  },
  {
    name: "Malitlit",
    center: [14.2626229, 121.10566],
    bounds: [
      [14.250658, 121.0900988],
      [14.2756581, 121.1186287],
    ],
  },
  {
    name: "Malusak",
    center: [14.3108176, 121.1169332],
    bounds: [
      [14.3072361, 121.1113942],
      [14.3151977, 121.122288],
    ],
  },
  {
    name: "Market Area (Poblacion)",
    center: [14.3201682, 121.1147134],
    bounds: [
      [14.3140608, 121.108677],
      [14.3266015, 121.1203224],
    ],
  },
  {
    name: "Kanluran",
    center: [14.3117552, 121.1098568],
    bounds: [
      [14.3096716, 121.1072764],
      [14.3145381, 121.1123403],
    ],
  },
  {
    name: "Pooc",
    center: [14.3017313, 121.1142973],
    bounds: [
      [14.2967346, 121.1045629],
      [14.3068651, 121.1241703],
    ],
  },
  {
    name: "Pulong Santa Cruz",
    center: [14.2760815, 121.0829545],
    bounds: [
      [14.2622339, 121.0726861],
      [14.2901259, 121.0956169],
    ],
  },
  {
    name: "Santo Domingo",
    center: [14.2301696, 121.0670115],
    bounds: [
      [14.2161787, 121.0463721],
      [14.2439554, 121.0860699],
    ],
  },
  {
    name: "Sinalhan",
    center: [14.3298579, 121.1055987],
    bounds: [
      [14.3238308, 121.0961597],
      [14.3363601, 121.1176571],
    ],
  },
  {
    name: "Tagapo",
    center: [14.3171512, 121.099567],
    bounds: [
      [14.3055397, 121.0886343],
      [14.3292999, 121.1123865],
    ],
  },
];

function locationKey(name: string): string {
  const key = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:barangay|brgy)\b\.?/g, "")
    .replace(/\(pob(?:lacion)?\.?\)/g, "")
    .replace(/\bsto\.?\s+/g, "santo ")
    .replace(/\bsta\.?\s+/g, "santa ")
    .replace(/\s+/g, " ")
    .trim();
  return key === "poblacion" ? "market area" : key;
}

export function findBarangayLocation(name: string): BarangayLocation | null {
  const key = locationKey(name);
  return (
    BARANGAY_LOCATIONS.find((location) => locationKey(location.name) === key) ??
    null
  );
}
