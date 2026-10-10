"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import type { EvacuationCenter } from "@/services/api";
import {
  Droplets,
  Utensils,
  HeartPulse,
  Package,
  Clock3,
  TriangleAlert,
} from "lucide-react";

export function ShelterSupplies({ center }: { center: EvacuationCenter }) {
  const { t, language } = useLanguage();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const updated = center.suppliesUpdatedAt
    ? Date.parse(center.suppliesUpdatedAt)
    : NaN;
  const stale = now !== null && now - updated > 86400000;
  return (
    <section className="shelter-supplies" aria-label={t("Shelter supplies")}>
      <div className="supply-heading">
        <Package size={19} aria-hidden="true" />
        <h4>{t("Shelter supplies")}</h4>
      </div>
      <dl className="supply-list">
        {(
          [
            ["Drinking water", center.waterStatus, Droplets],
            ["Food", center.foodStatus, Utensils],
            ["First aid", center.medicalStatus, HeartPulse],
          ] as const
        ).map(([label, value, Icon]) => (
          <div className="supply-row" key={label}>
            <dt>
              <span className="supply-icon">
                <Icon size={18} aria-hidden="true" />
              </span>
              {t(label)}
            </dt>
            <dd className={`supply-status supply-${value ?? "unknown"}`}>
              <span aria-hidden="true" />
              {t(value ?? "unknown")}
            </dd>
          </div>
        ))}
      </dl>
      <div className="supply-updated">
        <Clock3 size={15} aria-hidden="true" />
        <p>
          <span>{t("Last supply update")}</span>
          {Number.isFinite(updated) ? (
            <time dateTime={center.suppliesUpdatedAt!}>
              {new Date(updated).toLocaleString(
                language === "fil" ? "fil-PH" : "en-PH",
                { dateStyle: "medium", timeStyle: "short" },
              )}
            </time>
          ) : (
            <strong>{t("Not yet reported")}</strong>
          )}
        </p>
      </div>
      {stale && (
        <div className="supply-stale" role="note">
          <TriangleAlert size={17} aria-hidden="true" />
          <p>
            {t("Supply information is over 24 hours old. Confirm with staff.")}
          </p>
        </div>
      )}
    </section>
  );
}
