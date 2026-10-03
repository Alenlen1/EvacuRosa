"use client";
import { useLanguage } from "@/components/LanguageProvider";
export function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const tone = status === "AVAILABLE" ? "safe" : status === "FULL" ? "danger" : status === "NEARLY_FULL" || status === "NEARLY FULL" ? "warning" : "neutral";
  return <span className={`status-badge status-${tone}`}>{t(status.replaceAll("_", " "))}</span>;
}
