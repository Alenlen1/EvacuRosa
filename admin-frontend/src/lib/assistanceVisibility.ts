// Closed requests remain in the read-only archive, separate from active work.
export function isVisibleAssistanceRequest(request: {
  status: string;
}): boolean {
  return ["PENDING", "ACKNOWLEDGED", "DISPATCHED"].includes(request.status);
}
export function isArchivedAssistanceRequest(request: {
  status: string;
}): boolean {
  return ["COMPLETED", "CANCELLED"].includes(request.status);
}
