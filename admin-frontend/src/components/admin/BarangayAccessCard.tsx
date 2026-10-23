import type { CSSProperties } from "react";
import Image from "next/image";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import { barangayCardAppearance } from "@/lib/barangayCardAppearance";
import type { BarangayShelterSummary } from "@/lib/barangayShelterSummary";

export type BarangayCardShelterSummary = {
  status: BarangayShelterSummary["status"] | "LOADING" | "UNAVAILABLE";
  label: string;
  detail: string;
};

type Props = {
  barangay: { id: string; name: string };
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  featured?: boolean;
  shelterSummary: BarangayCardShelterSummary;
};

export function BarangayAccessCard({
  barangay,
  selected,
  disabled,
  onSelect,
  featured = false,
  shelterSummary,
}: Props) {
  const appearance = barangayCardAppearance(barangay.name);
  const colors = {
    "--barangay-card-background": appearance.background,
    "--barangay-card-accent": appearance.accent,
  } as CSSProperties;

  const name = <strong className="barangay-card-name">{barangay.name}</strong>;
  const logo = (
    <span
      className={`barangay-card-logo${appearance.logoSrc ? " has-logo" : ""}`}
      aria-hidden="true"
    >
      {appearance.logoSrc ? (
        <Image src={appearance.logoSrc} alt="" fill sizes="64px" />
      ) : (
        appearance.initials
      )}
    </span>
  );
  const info = (
    <span
      className="barangay-card-info"
      aria-busy={shelterSummary.status === "LOADING"}
    >
      <span
        className="barangay-card-status"
        data-status={shelterSummary.status}
      >
        {shelterSummary.label}
      </span>
      <small>{shelterSummary.detail}</small>
    </span>
  );

  if (featured) {
    return (
      <div className="barangay-access-feature" style={colors}>
        <div
          className="barangay-feature-identity barangay-selection-reveal"
          key={barangay.id}
        >
          {name}
          {logo}
          {info}
        </div>
        <button
          type="button"
          className="primary-button barangay-access-trigger"
          disabled={disabled}
          aria-label={`Enter access code for ${barangay.name}`}
          aria-haspopup="dialog"
          onClick={onSelect}
        >
          <LockKeyhole size={16} aria-hidden="true" />
          Enter access code
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="barangay-access-card"
      style={colors}
      disabled={disabled}
      aria-pressed={selected}
      aria-haspopup="dialog"
      onClick={onSelect}
    >
      <span className="barangay-card-header">{name}</span>
      {logo}
      {info}
      {selected && (
        <span className="barangay-card-selected" aria-hidden="true">
          <Check size={14} strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}
