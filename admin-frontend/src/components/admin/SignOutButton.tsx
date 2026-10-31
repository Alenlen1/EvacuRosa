"use client";

import { useRef, useState } from "react";
import { LoaderCircle, LogOut } from "lucide-react";
import styles from "./SignOutButton.module.css";

export function SignOutButton({
  className,
  disabled = false,
  onSignOut,
}: {
  className: string;
  disabled?: boolean;
  onSignOut?: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);

  async function signOut() {
    if (disabled || inFlight.current || !onSignOut) return;
    inFlight.current = true;
    setPending(true);
    setError(false);
    try {
      await onSignOut();
      // Keep the progress state until navigation unmounts this header.
    } catch {
      inFlight.current = false;
      setPending(false);
      setError(true);
    }
  }

  return (
    <span className={styles.control}>
      <button
        type="button"
        className={`${className}${pending ? ` ${styles.pending}` : ""}`}
        disabled={disabled || pending || !onSignOut}
        onClick={signOut}
        aria-busy={pending}
        title={pending ? "Signing out…" : "Sign out"}
      >
        {pending ? (
          <LoaderCircle
            className={styles.spinner}
            size={17}
            aria-hidden="true"
          />
        ) : (
          <LogOut size={17} aria-hidden="true" />
        )}
        <span aria-live="polite" aria-atomic="true">
          {pending ? "Signing out…" : "Sign out"}
        </span>
      </button>
      {error && (
        <span className={styles.error} role="alert">
          Could not sign out. Please try again.
        </span>
      )}
    </span>
  );
}
