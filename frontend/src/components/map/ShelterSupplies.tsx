"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import type { EvacuationCenter } from "@/services/api";

export function ShelterSupplies({ center }: { center: EvacuationCenter }) {
  const { t, language } = useLanguage();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const updated = center.suppliesUpdatedAt ? Date.parse(center.suppliesUpdatedAt) : NaN;
  return <section className="shelter-supplies" aria-label={t("Shelter supplies")}>
    <h4>{t("Shelter supplies")}</h4>
    <dl>{([["Drinking water", center.waterStatus], ["Food", center.foodStatus], ["First aid", center.medicalStatus]] as const)
      .map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{t(value ?? "unknown")}</dd></div>)}</dl>
    <p>{t("Last supply update")}: {Number.isFinite(updated) ? <time dateTime={center.suppliesUpdatedAt!}>{new Date(updated).toLocaleString(language === "fil" ? "fil-PH" : "en-PH")}</time> : t("Not yet reported")}</p>
    {now !== null && now - updated > 86400000 && <p className="warning-message">{t("Supply information is over 24 hours old. Confirm with staff.")}</p>}
  </section>;
}
