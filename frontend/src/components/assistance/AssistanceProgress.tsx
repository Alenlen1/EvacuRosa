import { Check } from "lucide-react";
import type { TrackedAssistance } from "@/lib/assistance";
import styles from "./AssistanceProvider.module.css";

const stages = [
  { status: "PENDING", label: "Submitted", compactLabel: "Submitted" },
  { status: "ACKNOWLEDGED", label: "Acknowledged", compactLabel: "Received" },
  {
    status: "DISPATCHED",
    label: "Help on the way",
    compactLabel: "On the way",
  },
  { status: "COMPLETED", label: "Completed", compactLabel: "Completed" },
] as const;

export function AssistanceProgress({
  tracking,
  outdated,
}: {
  tracking: TrackedAssistance;
  outdated: boolean;
}) {
  const status = tracking.request.status;
  const cancelled = status === "CANCELLED";
  const current = stages.findIndex((stage) => stage.status === status);

  return (
    <section className={styles.progress} aria-label="Request progress">
      <div className={styles.progressHeading}>
        <h3>{outdated ? "Last known progress" : "Request progress"}</h3>
        <span>
          {cancelled
            ? "Cancelled"
            : status === "COMPLETED"
              ? "Request completed"
              : `Step ${current + 1} of ${stages.length}`}
        </span>
      </div>
      <ol className={styles.progressStages}>
        {stages.map((stage, index) => {
          // Cancellation is not a completed stage. Show only milestones that
          // were actually recorded, leaving the remaining stages unreached.
          const complete = cancelled
            ? tracking.history.some((item) => item.new_status === stage.status)
            : index < current || status === "COMPLETED";
          const active = !cancelled && index === current;
          return (
            <li
              key={stage.status}
              data-complete={complete}
              aria-current={active ? "step" : undefined}
            >
              <span className={styles.progressMarker} aria-hidden="true">
                {complete ? <Check size={16} strokeWidth={2.5} /> : index + 1}
              </span>
              <span className={styles.progressLabel}>
                <span className={styles.progressFullLabel}>{stage.label}</span>
                <span className={styles.progressCompactLabel}>
                  {stage.compactLabel}
                </span>
              </span>
              <span className={styles.screenReaderOnly}>
                {active
                  ? "Current stage"
                  : complete
                    ? "Stage reached"
                    : "Not yet reached"}
              </span>
            </li>
          );
        })}
      </ol>
      {cancelled && (
        <p className={styles.progressNote}>
          This request has ended. Remaining stages were not completed.
        </p>
      )}
    </section>
  );
}
