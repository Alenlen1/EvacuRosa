import { Clock3, FileText, MapPin } from "lucide-react";
import type { AssistanceView } from "@/lib/assistanceView";
import styles from "./AssistanceProvider.module.css";

const tabs = [
  { view: "overview", label: "Overview", Icon: FileText },
  { view: "location", label: "Location", Icon: MapPin },
  { view: "history", label: "History", Icon: Clock3 },
] as const;

export function AssistanceRequestTabs({
  view,
  onChange,
}: {
  view: AssistanceView;
  onChange: (view: AssistanceView) => void;
}) {
  return (
    <div
      className={styles.requestTabs}
      role="tablist"
      aria-label="Assistance request views"
    >
      {tabs.map(({ view: value, label, Icon }, index) => (
        <button
          key={value}
          type="button"
          role="tab"
          id={`assistance-tab-${value}`}
          aria-controls="assistance-request-panel"
          aria-selected={view === value}
          tabIndex={view === value ? 0 : -1}
          onClick={() => onChange(value)}
          onKeyDown={(event) => {
            const direction =
              event.key === "ArrowRight"
                ? 1
                : event.key === "ArrowLeft"
                  ? -1
                  : 0;
            if (!direction && event.key !== "Home" && event.key !== "End")
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : (index + direction + tabs.length) % tabs.length;
            onChange(tabs[next].view);
            event.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
              [next]?.focus();
          }}
        >
          <Icon size={16} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
