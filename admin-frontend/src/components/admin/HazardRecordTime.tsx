import { Clock3 } from "lucide-react";
import { formatHazardDateTime } from "@/lib/hazardDateTime";

export function HazardRecordTime({
  value,
  label,
}: {
  value?: string | null;
  label: string;
}) {
  const formatted = formatHazardDateTime(value);
  return (
    <small className="hazard-record-time">
      <Clock3 size={12} aria-hidden="true" />
      <span>
        {label}:{" "}
        {formatted ? (
          <time dateTime={value ?? undefined}>{formatted}</time>
        ) : (
          "Unavailable"
        )}
      </span>
    </small>
  );
}
