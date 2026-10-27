"use client";

import { useEffect, useRef } from "react";
import { CircleAlert, LoaderCircle, X } from "lucide-react";
import styles from "./AssistanceProvider.module.css";

export function CancelAssistanceDialog({
  open,
  busy,
  error,
  onDismiss,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  error: string;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    else if (!open && element?.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.cancelDialog}
      aria-labelledby="cancel-assistance-title"
      aria-describedby="cancel-assistance-description"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onDismiss();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onDismiss();
      }}
      onClose={() => {
        if (open && !busy) onDismiss();
      }}
    >
      <div className={styles.cancelHeading}>
        <span className={styles.cancelIcon}>
          <CircleAlert size={26} aria-hidden="true" />
        </span>
        <button
          type="button"
          className={styles.closeButton}
          aria-label="Close cancellation confirmation"
          disabled={busy}
          onClick={onDismiss}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <h2 id="cancel-assistance-title">Cancel this request?</h2>
      <p id="cancel-assistance-description">
        CDRRMO will be notified that you no longer need assistance for this
        request. Its status history will remain available.
      </p>
      {error && (
        <p className={styles.feedback} role="alert">
          {error}
        </p>
      )}
      <div className={styles.cancelActions} aria-busy={busy}>
        <button
          type="button"
          className="secondary-button"
          autoFocus
          disabled={busy}
          onClick={onDismiss}
        >
          Keep request
        </button>
        <button
          type="button"
          className={styles.dangerButton}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy && (
            <LoaderCircle
              size={17}
              className={styles.spinner}
              aria-hidden="true"
            />
          )}
          {busy ? "Cancelling request..." : "Yes, cancel request"}
        </button>
      </div>
    </dialog>
  );
}
