import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

export type SheetState = "collapsed" | "partial" | "expanded";

export function RouteSheet({ state, onChange, title, summary, children, actions, onClearDestination, hideDetails = false }: {
  state: SheetState;
  onChange: (value: SheetState) => void;
  title: string;
  summary?: string;
  children: ReactNode;
  actions: ReactNode;
  onClearDestination?: () => void;
  hideDetails?: boolean;
}) {
  return (
    <aside className={`information-panel route-sheet sheet-${state}`} aria-label="Navigation information">
      <div className="sheet-controls">
        <h2 className="sheet-desktop-title">{title}</h2>
        <button className="sheet-toggle" onClick={() => onChange(state === "collapsed" ? "partial" : "collapsed")} aria-expanded={state !== "collapsed"} aria-controls="panel-details">
          <span className="sheet-handle" aria-hidden="true" />
          <span className="sheet-preview"><strong>{title}</strong>{summary && <small>{summary}</small>}</span>
          {state === "collapsed" ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {onClearDestination && <button type="button" className="sheet-clear" onClick={onClearDestination} aria-label="Remove destination" title="Remove destination"><X size={18} aria-hidden="true" /></button>}
      </div>
      <div className="sheet-body">
        <div className={`panel-scroll${hideDetails ? " panel-details-hidden" : ""}`} id="panel-details">{children}</div>
        {actions}
      </div>
    </aside>
  );
}
