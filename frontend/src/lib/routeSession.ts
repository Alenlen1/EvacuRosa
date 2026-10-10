import { TRAVEL_MODES, type TravelMode } from "./travelTime";

export const ROUTE_SESSION_KEY = "evacurosa-route-selection-v1";
export interface RouteSelection {
  destination: { latitude: number; longitude: number } | null;
  travelMode: TravelMode;
  intent: "route" | "evacuation" | null;
}
type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function parseRouteSelection(raw: string | null): RouteSelection | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (
      !v ||
      v.version !== 1 ||
      !Object.hasOwn(TRAVEL_MODES, v.travelMode) ||
      ![null, "route", "evacuation"].includes(v.intent)
    )
      return null;
    const d = v.destination;
    if (
      d !== null &&
      (!d ||
        !Number.isFinite(d.latitude) ||
        !Number.isFinite(d.longitude) ||
        Math.abs(d.latitude) > 90 ||
        Math.abs(d.longitude) > 180)
    )
      return null;
    if (v.intent === "route" && !d) return null;
    return {
      destination: d ? { latitude: d.latitude, longitude: d.longitude } : null,
      travelMode: v.travelMode,
      intent: v.intent,
    };
  } catch {
    return null;
  }
}

export function readRouteSelection(
  store?: SessionStore,
): RouteSelection | null {
  try {
    return parseRouteSelection(
      (store ?? window.sessionStorage).getItem(ROUTE_SESSION_KEY),
    );
  } catch {
    return null;
  }
}

/** Only destination/mode/intent; never store GPS origin, route geometry,
 * hazard assessments, emergency contact details or consent. */
export function saveRouteSelection(
  selection: RouteSelection,
  store?: SessionStore,
): void {
  try {
    const d = selection.destination;
    (store ?? window.sessionStorage).setItem(
      ROUTE_SESSION_KEY,
      JSON.stringify({
        version: 1,
        destination: d
          ? { latitude: d.latitude, longitude: d.longitude }
          : null,
        travelMode: selection.travelMode,
        intent: selection.intent,
      }),
    );
  } catch {
    /* Restricted storage must not prevent routing. */
  }
}

export function clearRouteSelection(store?: SessionStore): void {
  try {
    (store ?? window.sessionStorage).removeItem(ROUTE_SESSION_KEY);
  } catch {
    /* Storage may be disabled. */
  }
}
