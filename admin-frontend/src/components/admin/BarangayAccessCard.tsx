import type { CSSProperties } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { barangayCardAppearance } from "@/lib/barangayCardAppearance";

type Props = {
  barangay: { id: string; name: string };
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
};

export function BarangayAccessCard({
  barangay,
  selected,
  disabled,
  onSelect,
}: Props) {
  const appearance = barangayCardAppearance(barangay.name);
  const colors = {
    "--barangay-card-background": appearance.background,
    "--barangay-card-accent": appearance.accent,
  } as CSSProperties;

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
      <strong className="barangay-card-name">{barangay.name}</strong>
      <span
        className={`barangay-card-logo${appearance.logoSrc ? " has-logo" : ""}`}
        aria-hidden="true"
      >
        {appearance.logoSrc ? (
          <Image src={appearance.logoSrc} alt="" fill sizes="80px" />
        ) : (
          appearance.initials
        )}
      </span>
      <span className="barangay-card-info">
        <span>Evacuation center workspace</span>
        <small>Santa Rosa, Laguna</small>
      </span>
      {selected && (
        <span className="barangay-card-selected" aria-hidden="true">
          <Check size={14} strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}
