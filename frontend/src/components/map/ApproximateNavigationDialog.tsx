"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import styles from "./ApproximateNavigationDialog.module.css";

export function ApproximateNavigationDialog({
  accuracy,
  canConfirm,
  blockedReason,
  onDismiss,
  onConfirm,
  onRefresh,
}: {
  accuracy: number | null;
  canConfirm: boolean;
  blockedReason: string;
  onDismiss: () => void;
  onConfirm: () => void;
  onRefresh?: () => void;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    refreshButton.current?.focus({ preventScroll: true });
    return () => element?.close();
  }, []);

  // Keep the native modal outside Leaflet's transformed panes and map events.
  return createPortal(
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="approximate-navigation-title"
      aria-describedby="approximate-navigation-description"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header>
        <CircleAlert size={28} aria-hidden="true" />
        <button type="button" aria-label={t("Close")} onClick={onDismiss}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <h2 id="approximate-navigation-title">
        {t("Start with approximate location?")}
      </h2>
      <p id="approximate-navigation-description">
        {accuracy !== null &&
          t(
            "Your location may be inaccurate by approximately {accuracy} metres. Navigation may show you on the wrong road.",
            { accuracy: Math.ceil(accuracy) },
          )}
      </p>
      <p>
        {t(
          "Route progress, automatic rerouting and arrival detection pause until location accuracy improves. Follow local signs and conditions.",
        )}
      </p>
      {!canConfirm && <p role="status">{blockedReason}</p>}
      <footer>
        <button
          ref={refreshButton}
          type="button"
          autoFocus
          onClick={onRefresh ?? onDismiss}
        >
          {t(onRefresh ? "Refresh location" : "Cancel")}
        </button>
        <button
          type="button"
          className={styles.confirm}
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          {t("Start anyway")}
        </button>
      </footer>
    </dialog>,
    document.body,
  );
}
