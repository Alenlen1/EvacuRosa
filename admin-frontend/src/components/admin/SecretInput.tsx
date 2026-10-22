"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
  secretLabel: "password" | "code";
  retainInputFocus?: boolean;
};

export function SecretInput({
  secretLabel,
  disabled,
  retainInputFocus = false,
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="admin-secret-field">
      <input
        {...props}
        disabled={disabled}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        className="secret-visibility-toggle"
        aria-label={`${visible ? "Hide" : "Show"} ${secretLabel}`}
        aria-controls={props.id}
        aria-pressed={visible}
        disabled={disabled}
        onPointerDown={(event) => {
          if (retainInputFocus && document.activeElement?.id === props.id)
            event.preventDefault();
        }}
        onClick={() => setVisible((current) => !current)}
      >
        <Icon size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
