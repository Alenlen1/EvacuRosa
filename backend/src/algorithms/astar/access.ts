export const TRAVEL_MODES = ["walking", "biking", "motorcycle", "car"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];
export function isTravelMode(value: unknown): value is TravelMode {
  return TRAVEL_MODES.some(mode => mode === value);
}

const hierarchy: Record<TravelMode, string[]> = {
  walking: ["access", "foot"],
  biking: ["access", "vehicle", "bicycle"],
  motorcycle: ["access", "vehicle", "motor_vehicle", "motorcycle"],
  car: ["access", "vehicle", "motor_vehicle", "motorcar"],
};

/** Public-through-routing policy: unresolved conditional/destination/private
 * access is excluded rather than assuming the traveler is authorized. */
export function permittedModes(tags: Record<string, string>, reverse: boolean): TravelMode[] {
  const direction = reverse ? "backward" : "forward";
  return TRAVEL_MODES.filter(mode => {
    const highway = tags.highway;
    if (!highway || ["construction", "proposed"].includes(highway)) return false;
    let allowed = mode === "walking"
      ? !["motorway", "motorway_link", "trunk", "trunk_link"].includes(highway)
      : mode === "biking"
      ? !["motorway", "motorway_link", "trunk", "trunk_link", "footway", "pedestrian", "steps"].includes(highway)
      : !["path", "footway", "pedestrian", "steps", "cycleway", "bridleway"].includes(highway);
    for (const key of hierarchy[mode]) {
      for (const candidate of [key, `${key}:${direction}`]) {
        if (tags[candidate] !== undefined) {
          allowed = ["yes", "permissive", "designated", "official"].includes(tags[candidate]);
        }
      }
    }
    if (!allowed) return false;
    if (hierarchy[mode].some(key => tags[`${key}:conditional`] || tags[`${key}:${direction}:conditional`])) return false;
    let oneway = mode === "walking" ? "no" : tags.oneway ??
      (tags.junction === "roundabout" || highway === "motorway" || highway === "motorway_link" ? "yes" : "no");
    for (const key of hierarchy[mode].filter(key => key !== "access")) {
      oneway = tags[`oneway:${key}`] ?? oneway;
      if (tags[`oneway:${key}:conditional`]) return false;
    }
    if (mode !== "walking" && tags["oneway:conditional"]) return false;
    if (["no", "0", "false"].includes(oneway)) return true;
    if (["yes", "1", "true"].includes(oneway)) return !reverse;
    if (oneway === "-1") return reverse;
    return false; // Reversible/alternating roads need rules we cannot evaluate.
  });
}
