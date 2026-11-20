"use client";

import { useState, type ReactNode } from "react";
import { CircleAlert, Info, MapPin } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import {
  EarthquakeIcon,
  FireIcon,
  FloodIcon,
} from "@/components/ui/HazardIcons";
import { isInsideSantaRosa } from "@/lib/mapBounds";
import type {
  EarthquakeEvent,
  EarthquakeRoadImpact,
  FireIncident,
  FloodReport,
} from "@/services/api";
import { PublicSkeleton } from "./PublicSkeleton";
import styles from "./HazardReports.module.css";

type HazardType = "flood" | "fire" | "earthquake";

export type HazardMapFocus = {
  type: HazardType;
  latitude: number;
  longitude: number;
};

function HazardReportCard({
  title,
  severity,
  blocked = false,
  impact,
  barangay,
  notes,
  timestamp,
  onViewOnMap,
}: {
  title: string;
  severity?: string;
  blocked?: boolean;
  impact?: string;
  barangay?: string;
  notes?: string;
  timestamp?: string;
  onViewOnMap?: () => void;
}) {
  const { language, t } = useLanguage();
  const date = timestamp ? new Date(timestamp) : null;
  return (
    <li className={styles.card} data-blocked={blocked}>
      <div className={styles.cardHeading}>
        <strong>{title}</strong>
        {severity && <span className={styles.severity}>{t(severity)}</span>}
      </div>
      {impact && (
        <p className={styles.impact}>
          {blocked && <CircleAlert size={15} aria-hidden="true" />}
          {impact}
        </p>
      )}
      {barangay && (
        <p className={styles.meta}>
          <MapPin size={14} aria-hidden="true" /> {barangay}
        </p>
      )}
      {notes && <p className={styles.notes}>{notes}</p>}
      {date && Number.isFinite(date.getTime()) && (
        <time className={styles.meta} dateTime={timestamp}>
          {new Intl.DateTimeFormat(language === "fil" ? "fil-PH" : "en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Manila",
          }).format(date)}
          {" PHT"}
        </time>
      )}
      {onViewOnMap && (
        <button
          type="button"
          className={styles.viewOnMap}
          onClick={onViewOnMap}
        >
          <MapPin size={15} aria-hidden="true" />
          {t("Show on map")}
        </button>
      )}
    </li>
  );
}

export function HazardReports({
  floods,
  fires,
  earthquakeImpacts,
  earthquakeEvents,
  status,
  onViewOnMap,
}: {
  floods: FloodReport[];
  fires: FireIncident[];
  earthquakeImpacts: EarthquakeRoadImpact[];
  earthquakeEvents: EarthquakeEvent[];
  status: "loading" | "available" | "unavailable";
  onViewOnMap?: (target: HazardMapFocus) => void;
}) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<"all" | HazardType>("all");

  if (status === "loading") return <PublicSkeleton kind="hazards" />;

  if (status === "unavailable") {
    return (
      <div className={styles.notice} role="status">
        <CircleAlert size={18} aria-hidden="true" />
        <div>
          <strong>{t("Hazard reports unavailable")}</strong>
          <p>
            {t(
              "Connect to the internet to load reports. Follow local emergency guidance.",
            )}
          </p>
        </div>
      </div>
    );
  }

  function showOnMap(
    type: HazardType,
    point?: { latitude: number; longitude: number } | null,
  ) {
    if (
      !onViewOnMap ||
      !point ||
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude) ||
      !isInsideSantaRosa(point.latitude, point.longitude)
    )
      return;
    return () =>
      onViewOnMap({
        type,
        latitude: point.latitude,
        longitude: point.longitude,
      });
  }

  const groups = [
    {
      id: "flood" as const,
      label: "Flood",
      heading: "Flood reports",
      icon: FloodIcon,
      reports: floods.map((report) => ({
        id: report.id,
        title: t("Flood report"),
        severity: report.severity,
        blocked: report.roadImpassable,
        impact: t(
          report.roadImpassable ? "Road blocked" : "Road reported passable",
        ),
        barangay: report.barangayName,
        notes: report.notes,
        timestamp: report.reportedAt,
        onViewOnMap: showOnMap("flood", report.affectedSegments[0]?.[0]),
      })),
    },
    {
      id: "fire" as const,
      label: "Fire",
      heading: "Fire incidents",
      icon: FireIcon,
      reports: fires.map((incident) => {
        const count = incident.confirmedBlockedRoadIds.length;
        return {
          id: incident.id,
          title: t("Fire incident"),
          severity: incident.severity,
          blocked: count > 0,
          impact: t(
            count === 1
              ? "1 confirmed road closure"
              : count > 1
                ? "{count} confirmed road closures"
                : "No confirmed road blockage",
            { count },
          ),
          barangay: incident.barangayName,
          notes: incident.notes,
          timestamp: incident.reportedAt,
          onViewOnMap: showOnMap("fire", incident),
        };
      }),
    },
    {
      id: "earthquake" as const,
      label: "Earthquake",
      heading: "Earthquake reports",
      icon: EarthquakeIcon,
      reports: [
        ...earthquakeImpacts.map((impact) => ({
          id: impact.id,
          title: t(
            impact.roadId == null
              ? "Earthquake area report"
              : "Earthquake road impact",
          ),
          severity: impact.impactLevel,
          blocked: impact.roadId != null && impact.confirmedBlocked,
          impact: t(
            impact.roadId == null
              ? "No road routing change"
              : impact.confirmedBlocked
                ? "Road blocked"
                : "No confirmed road blockage",
          ),
          notes: impact.notes,
          timestamp: impact.verifiedAt,
          onViewOnMap: showOnMap(
            "earthquake",
            impact.affectedSegments?.[0]?.[0] ?? impact.impactArea,
          ),
        })),
        ...earthquakeEvents.map((event) => ({
          id: event.id,
          title: t("Magnitude {magnitude} earthquake", {
            magnitude: event.magnitude.toFixed(1),
          }),
          blocked: false,
          notes: event.notes,
          timestamp: event.occurredAt,
          onViewOnMap: showOnMap("earthquake", event),
        })),
      ],
    },
  ].map((group) => ({
    ...group,
    blockedCount: group.reports.filter((report) => report.blocked).length,
  }));

  const total = groups.reduce(
    (count, group) => count + group.reports.length,
    0,
  );
  const blocked = groups.reduce(
    (count, group) => count + group.blockedCount,
    0,
  );
  const visibleGroups = groups
    .filter((group) => filter === "all" || filter === group.id)
    .sort((a, b) => b.blockedCount - a.blockedCount);
  const shown = visibleGroups.reduce(
    (count, group) => count + group.reports.length,
    0,
  );

  function filterButton(
    id: "all" | HazardType,
    label: string,
    count: number,
    icon?: ReactNode,
  ) {
    return (
      <button
        key={id}
        type="button"
        className={styles.filter}
        aria-pressed={filter === id}
        onClick={() => setFilter(id)}
      >
        {icon}
        <span>{label}</span>
        <span className={styles.count}>{count}</span>
      </button>
    );
  }

  return (
    <section className={styles.reports} aria-label={t("Hazard reports")}>
      <div className={styles.notice} data-blocked={blocked > 0}>
        {blocked > 0 ? (
          <CircleAlert size={18} aria-hidden="true" />
        ) : (
          <Info size={18} aria-hidden="true" />
        )}
        <div>
          {blocked > 0 && (
            <strong>
              {t(
                blocked === 1
                  ? "1 report with a road closure"
                  : "{count} reports with road closures",
                { count: blocked },
              )}
            </strong>
          )}
          <p>
            {t(
              "Conditions can change. Always follow local emergency guidance.",
            )}
          </p>
        </div>
      </div>
      <div
        className={styles.filters}
        role="group"
        aria-label={t("Filter hazard reports")}
      >
        {filterButton("all", t("All"), total)}
        {groups.map(({ id, label, reports, icon: Icon }) =>
          filterButton(
            id,
            t(label),
            reports.length,
            <Icon size={15} aria-hidden="true" />,
          ),
        )}
      </div>
      <p className={styles.resultCount} role="status">
        {t(shown === 1 ? "1 report shown" : "{count} reports shown", {
          count: shown,
        })}
      </p>
      {shown === 0 ? (
        <div className={styles.empty}>
          <strong>
            {t(
              filter === "all"
                ? "No reports available"
                : "No reports for this hazard",
            )}
          </strong>
          <p>{t("Unreported hazards may still be present.")}</p>
        </div>
      ) : (
        visibleGroups
          .filter((group) => group.reports.length > 0)
          .map(({ id, heading, icon: Icon, reports }) => (
            <section key={id} className={styles.group}>
              <h3>
                <Icon size={18} aria-hidden="true" /> {t(heading)}
              </h3>
              <ul>
                {[...reports]
                  .sort((a, b) => Number(b.blocked) - Number(a.blocked))
                  .map(({ id, ...report }) => (
                    <HazardReportCard key={id} {...report} />
                  ))}
              </ul>
            </section>
          ))
      )}
    </section>
  );
}
