import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type SheetState = "collapsed" | "partial" | "expanded";

export function RouteSheet({ state, onChange, title, summary, children, actions }: {
  state: SheetState;
  onChange: (value: SheetState) => void;
  title: string;
  summary?: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <aside className={`information-panel route-sheet sheet-${state}`} aria-label="Navigation information">
      <div className="sheet-controls">
        <button className="sheet-toggle" onClick={() => onChange(state === "collapsed" ? "partial" : "collapsed")} aria-expanded={state !== "collapsed"} aria-controls="panel-details">
          <span className="sheet-handle" aria-hidden="true" />
          <span className="sheet-preview"><strong>{title}</strong>{summary && <small>{summary}</small>}</span>
          {state === "collapsed" ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {state !== "collapsed" && <button className="sheet-size-button" onClick={() => onChange(state === "partial" ? "expanded" : "partial")} aria-controls="panel-details">{state === "partial" ? "Full details" : "Less detail"}</button>}
      </div>
      <div className="panel-scroll" id="panel-details">{children}</div>
      {actions}
    </aside>
  );
}
