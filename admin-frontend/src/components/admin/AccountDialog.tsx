"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { X } from "lucide-react";
import styles from "./ChangePasswordDialog.module.css";

export function AccountDialog({
  title,
  icon,
  busy,
  onClose,
  returnFocusRef,
  children,
}: {
  title: string;
  icon: ReactNode;
  busy: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = returnFocusRef?.current ?? document.activeElement;
    element?.showModal();
    element
      ?.querySelector<HTMLInputElement>("input")
      ?.focus({ preventScroll: true });
    return () => {
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, [returnFocusRef]);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className={styles.content}>
        <header className={styles.heading}>
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
          <div>
            <p className={styles.eyebrow}>YOUR ACCOUNT</p>
            <h2 id={`${id}-title`}>{title}</h2>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label={`Close ${title.toLowerCase()}`}
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
