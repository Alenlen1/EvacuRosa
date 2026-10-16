import { TRAVEL_MODES, type TravelMode } from "./travelTime";

export const ROUTE_SESSION_KEY = "evacurosa-route-selection-v1";
export interface RouteSelection {
  destination: { latitude: number; longitude: number } | null;
  travelMode: TravelMode;
  intent: "route" | "evacuation" | null;
  navigationActive?: boolean;
  navigationCenterId?: string;
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
      ...(v.navigationActive === true && v.intent && d
        ? {
            navigationActive: true,
            ...(typeof v.navigationCenterId === "string" &&
            v.navigationCenterId.length > 0 &&
            v.navigationCenterId.length <= 128
              ? { navigationCenterId: v.navigationCenterId }
              : {}),
          }
        : {}),
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

/** Only destination/mode/intent and navigation intent; never store GPS origin, route geometry,
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
        ...(selection.navigationActive === true && selection.intent && d
          ? {
              navigationActive: true,
              ...(typeof selection.navigationCenterId === "string" &&
              selection.navigationCenterId.length > 0 &&
              selection.navigationCenterId.length <= 128
                ? { navigationCenterId: selection.navigationCenterId }
                : {}),
            }
          : {}),
      }),
    );
  } catch {
    /* Restricted storage must not prevent routing. */
  }
}

export function setRouteNavigation(
  active: boolean,
  centerId?: string,
  store?: SessionStore,
): void {
  const selection = readRouteSelection(store);
  if (selection)
    saveRouteSelection(
      {
        ...selection,
        navigationActive: active,
        navigationCenterId: active ? centerId : undefined,
      },
      store,
    );
}

export function clearRouteSelection(store?: SessionStore): void {
  try {
    (store ?? window.sessionStorage).removeItem(ROUTE_SESSION_KEY);
  } catch {
    /* Storage may be disabled. */
  }
}
