export function StatusBadge({ status }: { status: string }) {
  const tone = status === "AVAILABLE" ? "safe" : status === "FULL" ? "danger" : status === "NEARLY_FULL" || status === "NEARLY FULL" ? "warning" : "neutral";
  return <span className={`status-badge status-${tone}`}>{status.replaceAll("_", " ")}</span>;
}
