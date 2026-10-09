"use client";
import { useLanguage } from "@/components/LanguageProvider";
import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

export type SheetState = "collapsed" | "partial" | "expanded";

export function RouteSheet({ state, onChange, title, summary, children, actions, mobileActions, mobileTravelMode, onClearDestination, hideDetails = false }: {
  state: SheetState;
  onChange: (value: SheetState) => void;
  title: string;
  summary?: string;
  children: ReactNode;
  actions: ReactNode;
  mobileActions?: ReactNode;
  mobileTravelMode?: ReactNode;
  onClearDestination?: () => void;
  hideDetails?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <aside className={`information-panel route-sheet sheet-${state}`} aria-label={t("Navigation information")}>
      <div className="mobile-travel-mode">{mobileTravelMode}</div>
      <div className="sheet-controls">
        <h2 className="sheet-desktop-title">{title}</h2>
        <button type="button" className="sheet-toggle" onClick={() => onChange(state === "collapsed" ? "partial" : "collapsed")} aria-expanded={state !== "collapsed"} aria-controls="sheet-details">
          <span className="sheet-handle" aria-hidden="true" />
          <span className="sheet-preview"><strong>{title}</strong>{summary && <small>{summary}</small>}</span>
          {state === "collapsed" ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        <button type="button" className="sheet-size-button" onClick={() => onChange(state === "expanded" ? "collapsed" : "expanded")} aria-controls="sheet-details" aria-expanded={state === "expanded"}>{t(state === "expanded" ? "More map" : "View full details")}</button>
        {onClearDestination && <button type="button" className="sheet-clear" onClick={onClearDestination} aria-label={t("Remove destination")} title={t("Remove destination")}><X size={18} aria-hidden="true" /></button>}
      </div>
      <div className="sheet-body" id="sheet-details">
        <div className={`panel-scroll${hideDetails ? " panel-details-hidden" : ""}`} id="panel-details">{children}</div>
        {actions}
      </div>
      <div className="sheet-mobile-actions">{mobileActions}</div>
    </aside>
  );
}
