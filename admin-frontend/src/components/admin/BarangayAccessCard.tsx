import type { CSSProperties } from "react";
import Image from "next/image";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import { barangayCardAppearance } from "@/lib/barangayCardAppearance";

type Props = {
  barangay: { id: string; name: string };
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  featured?: boolean;
};

export function BarangayAccessCard({
  barangay,
  selected,
  disabled,
  onSelect,
  featured = false,
}: Props) {
  const appearance = barangayCardAppearance(barangay.name);
  const colors = {
    "--barangay-card-background": appearance.background,
    "--barangay-card-accent": appearance.accent,
  } as CSSProperties;

  const identity = (
    <>
      <strong className="barangay-card-name">{barangay.name}</strong>
      <span
        className={`barangay-card-logo${appearance.logoSrc ? " has-logo" : ""}`}
        aria-hidden="true"
      >
        {appearance.logoSrc ? (
          <Image
            src={appearance.logoSrc}
            alt=""
            fill
            sizes={featured ? "(max-width: 900px) 64px, 80px" : "64px"}
          />
        ) : (
          appearance.initials
        )}
      </span>
      <span className="barangay-card-info">
        <span>Evacuation center workspace</span>
        <small>Santa Rosa, Laguna</small>
      </span>
    </>
  );

  if (featured) {
    return (
      <div className="barangay-access-feature" style={colors}>
        <div className="barangay-feature-identity">{identity}</div>
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
      {identity}
      {selected && (
        <span className="barangay-card-selected" aria-hidden="true">
          <Check size={14} strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}
