"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleCheck, CircleX, Trash2, Truck, X } from "lucide-react";
import styles from "./DeleteConfirmationDialog.module.css";

export interface ConfirmationPrompt {
  title: string;
  description: string;
  subject?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "delete" | "dispatch" | "complete" | "cancel";
}

function ConfirmationDialog({
  prompt,
  onAnswer,
}: {
  prompt: ConfirmationPrompt;
  onAnswer: (confirmed: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const Icon =
    prompt.variant === "dispatch"
      ? Truck
      : prompt.variant === "complete"
        ? CircleCheck
        : prompt.variant === "cancel"
          ? CircleX
          : Trash2;
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    cancelRef.current?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      data-variant={prompt.variant ?? "delete"}
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        onAnswer(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onAnswer(false);
      }}
    >
      <div className={styles.content}>
        <button
          type="button"
          className={styles.close}
          aria-label={
            prompt.variant && prompt.variant !== "delete"
              ? "Close action confirmation"
              : "Close delete confirmation"
          }
          onClick={() => onAnswer(false)}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <header className={styles.heading}>
          <span className={styles.icon}>
            <Icon size={24} aria-hidden="true" />
          </span>
          <h2 id={`${id}-title`}>{prompt.title}</h2>
        </header>
        <div className={styles.body}>
          {prompt.subject && <p className={styles.subject}>{prompt.subject}</p>}
          <p id={`${id}-description`}>{prompt.description}</p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            ref={cancelRef}
            autoFocus
            onClick={() => onAnswer(false)}
          >
            {prompt.cancelLabel ?? "Keep record"}
          </button>
          <button
            type="button"
            className={styles.remove}
            onClick={() => onAnswer(true)}
          >
            <Icon size={16} aria-hidden="true" />
            {prompt.confirmLabel ?? "Delete record"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function useConfirmation() {
  const [prompt, setPrompt] = useState<ConfirmationPrompt | null>(null);
  const resolve = useRef<((confirmed: boolean) => void) | null>(null);
  useEffect(
    () => () => {
      resolve.current?.(false);
      resolve.current = null;
    },
    [],
  );
  function confirm(next: ConfirmationPrompt): Promise<boolean> {
    if (resolve.current) return Promise.resolve(false);
    return new Promise((answer) => {
      resolve.current = answer;
      setPrompt(next);
    });
  }
  const dialog = prompt ? (
    <ConfirmationDialog
      prompt={prompt}
      onAnswer={(confirmed) => {
        const answer = resolve.current;
        resolve.current = null;
        setPrompt(null);
        answer?.(confirmed);
      }}
    />
  ) : null;
  return { confirm, dialog };
}

export function useDeleteConfirmation() {
  const { confirm, dialog } = useConfirmation();
  return { confirmDelete: confirm, deleteDialog: dialog };
}
