"use client";
import { useLanguage } from "@/components/LanguageProvider";
import { CircleCheck, TriangleAlert, CircleMinus, LockKeyhole, CircleHelp } from "lucide-react";
export function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const tone = status === "AVAILABLE" ? "safe" : status === "FULL" ? "danger" : status === "NEARLY_FULL" || status === "NEARLY FULL" ? "warning" : "neutral";
  const Icon = status === "AVAILABLE" ? CircleCheck : status === "FULL" ? CircleMinus : tone === "warning" ? TriangleAlert : status === "CLOSED" ? LockKeyhole : CircleHelp;
  return <span className={`status-badge status-${tone}`}><Icon size={14} aria-hidden="true" />{t(status.replaceAll("_", " "))}</span>;
}
