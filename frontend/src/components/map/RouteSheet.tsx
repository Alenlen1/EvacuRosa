"use client";
import { useLanguage } from "@/components/LanguageProvider";
import type { ReactNode, Ref } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Map,
  ShieldAlert,
  X,
} from "lucide-react";
import styles from "./RouteSheet.module.css";

export type SheetState = "collapsed" | "partial" | "expanded";

export function RouteSheet({
  state,
  onChange,
  title,
  summary,
  children,
  actions,
  desktopActions,
  mobileActions,
  mobileTravelMode,
  onClearDestination,
  hideDetails = false,
  activeView,
  onViewChange,
  onBackToMap,
  detailsRef,
}: {
  state: SheetState;
  onChange: (value: SheetState) => void;
  title: string;
  summary?: string;
  children: ReactNode;
  actions: ReactNode;
  desktopActions?: ReactNode;
  mobileActions?: ReactNode;
  mobileTravelMode?: ReactNode;
  onClearDestination?: () => void;
  hideDetails?: boolean;
  activeView: "map" | "centers" | "hazards";
  onViewChange: (view: "map" | "centers" | "hazards") => void;
  onBackToMap: () => void;
  detailsRef?: Ref<HTMLDivElement>;
}) {
  const { t } = useLanguage();
  return (
    <aside
      className={`information-panel route-sheet sheet-${state} ${styles.sheet}`}
      data-active-view={activeView}
      aria-label={t("Navigation information")}
    >
      <nav className="sheet-view-tabs" aria-label={t("Map views")}>
        {(
          [
            { id: "map", label: "Map", icon: Map },
            { id: "centers", label: "Centers", icon: Building2 },
            { id: "hazards", label: "Hazards", icon: ShieldAlert },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={activeView === id ? "page" : undefined}
            onClick={() => onViewChange(id)}
          >
            <Icon size={17} aria-hidden="true" />
            {t(label)}
          </button>
        ))}
      </nav>
      {mobileTravelMode && (
        <div className="mobile-travel-mode">{mobileTravelMode}</div>
      )}
      <div className="sheet-controls">
        <h2 className="sheet-desktop-title">{title}</h2>
        <button
          type="button"
          className="sheet-toggle"
          onClick={() =>
            onChange(state === "collapsed" ? "partial" : "collapsed")
          }
          aria-expanded={state !== "collapsed"}
          aria-controls="sheet-details"
        >
          <span className="sheet-handle" aria-hidden="true" />
          <span className="sheet-preview">
            <strong>{title}</strong>
            {summary && <small>{summary}</small>}
          </span>
          {state === "collapsed" ? (
            <ChevronUp size={20} />
          ) : (
            <ChevronDown size={20} />
          )}
        </button>
        <button
          type="button"
          className="sheet-size-button"
          onClick={() =>
            state === "expanded" ? onBackToMap() : onChange("expanded")
          }
          aria-controls="sheet-details"
          aria-expanded={state === "expanded"}
        >
          {t(state === "expanded" ? "Back to map" : "View full details")}
        </button>
      </div>
      <div className="sheet-body" id="sheet-details">
        <div className="panel-scroll" id="panel-details" ref={detailsRef}>
          {mobileTravelMode && (
            <div className="sheet-inline-travel-mode">{mobileTravelMode}</div>
          )}
          {!hideDetails && children}
          {actions}
          {onClearDestination && (
            <button
              type="button"
              className="sheet-clear"
              onClick={onClearDestination}
            >
              <X size={16} aria-hidden="true" />
              {t("Clear destination")}
            </button>
          )}
        </div>
      </div>
      <div className="sheet-desktop-actions">{desktopActions}</div>
      <div className="sheet-mobile-actions">{mobileActions}</div>
    </aside>
  );
}
