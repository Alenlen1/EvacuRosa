export type AssistanceView = "overview" | "location" | "history";
export const ASSISTANCE_VIEW_KEY = "evacurosa-assistance-view-v1";

export function readAssistanceView(
  requestId: string,
): { open: boolean; view: AssistanceView } | null {
  try {
    const raw = sessionStorage.getItem(ASSISTANCE_VIEW_KEY);
    if (!raw || raw.length > 500) return null;
    const saved = JSON.parse(raw);
    if (
      saved.requestId !== requestId ||
      typeof saved.open !== "boolean" ||
      !["overview", "location", "history"].includes(saved.view)
    )
      return null;
    return { open: saved.open, view: saved.view };
  } catch {
    return null;
  }
}

// Presentation only; request credentials remain in the existing tracking store.
export function writeAssistanceView(
  requestId: string,
  open: boolean,
  view: AssistanceView,
) {
  try {
    sessionStorage.setItem(
      ASSISTANCE_VIEW_KEY,
      JSON.stringify({ requestId, open, view }),
    );
  } catch {
    /* Tracking must still work if session storage is unavailable. */
  }
}

export function clearAssistanceView() {
  try {
    sessionStorage.removeItem(ASSISTANCE_VIEW_KEY);
  } catch {
    /* The in-memory view still resets. */
  }
}
