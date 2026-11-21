import { TRAVEL_MODES, type TravelMode } from "../../../frontend/src/lib/travelTime";

export const ASSISTANCE_MAP_COLORS = {
  PENDING: "#2563eb",
  ACKNOWLEDGED: "#b7791f",
  DISPATCHED: "#b03a2e",
  COMPLETED: "#28764b",
  CANCELLED: "#6b7280",
} as const;

const timeFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function assistanceDisplayName(request: {
  id: string;
  display_name?: string | null;
}) {
  return (
    request.display_name?.trim() ||
    `Request #${request.id.slice(0, 8).toUpperCase()}`
  );
}

export function assistanceTravelModeLabel(mode: unknown) {
  if (typeof mode === "string" && Object.hasOwn(TRAVEL_MODES, mode)) {
    return TRAVEL_MODES[mode as TravelMode].label;
  }
  return "Travel mode unavailable";
}

export function assistanceTime(value: string | null | undefined) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? `${timeFormat.format(date)} PHT`
    : "Time unavailable";
}
