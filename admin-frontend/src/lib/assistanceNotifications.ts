import type { AssistanceRequest } from "../../../frontend/src/services/api";
import { isVisibleAssistanceRequest } from "./assistanceVisibility";

export interface AssistanceNotificationState {
  newestTime: number | null;
  newestIds: string[];
  unread: AssistanceRequest[];
}

export function emptyAssistanceNotifications(): AssistanceNotificationState {
  return { newestTime: null, newestIds: [], unread: [] };
}

// Only call with the unfiltered first page of active requests. The first
// successful response establishes a baseline, rather than alerting for backlog.
export function reconcileAssistanceNotifications(
  current: AssistanceNotificationState,
  requests: AssistanceRequest[],
): { state: AssistanceNotificationState; arrivals: AssistanceRequest[] } {
  const active = requests.filter(isVisibleAssistanceRequest);
  const valid = active.filter((request) =>
    Number.isFinite(Date.parse(request.created_at)),
  );
  const newestTime = Math.max(
    current.newestTime ?? 0,
    ...valid.map((request) => Date.parse(request.created_at)),
  );
  const newestIds = new Set(
    newestTime === current.newestTime ? current.newestIds : [],
  );
  for (const request of valid)
    if (Date.parse(request.created_at) === newestTime)
      newestIds.add(request.id);

  const arrivals =
    current.newestTime === null
      ? []
      : valid.filter((request) => {
          const time = Date.parse(request.created_at);
          return (
            time > current.newestTime! ||
            (time === current.newestTime &&
              !current.newestIds.includes(request.id))
          );
        });
  const unreadIds = new Set([
    ...current.unread.map((request) => request.id),
    ...arrivals.map((request) => request.id),
  ]);
  return {
    // Keep notifications bounded to the latest active page, and drop closed
    // requests. A backfilled older row is never treated as a new submission.
    state: {
      newestTime,
      newestIds: [...newestIds],
      unread: active.filter((row) => unreadIds.has(row.id)),
    },
    arrivals,
  };
}

export function markAssistanceReviewed(
  current: AssistanceNotificationState,
  id: string,
): AssistanceNotificationState {
  return {
    ...current,
    unread: current.unread.filter((request) => request.id !== id),
  };
}
