// Retain cancelled records for audit, but omit them from CDRRMO location views.
export function isVisibleAssistanceRequest(request: {
  status: string;
}): boolean {
  return request.status !== "CANCELLED";
}
