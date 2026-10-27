"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import styles from "./DeleteConfirmationDialog.module.css";

interface DeletePrompt {
  title: string;
  description: string;
  subject?: string;
  confirmLabel?: string;
}

function DeleteConfirmationDialog({
  prompt,
  onAnswer,
}: {
  prompt: DeletePrompt;
  onAnswer: (confirmed: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const id = useId();
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
        <span className={styles.icon}>
          <Trash2 size={24} aria-hidden="true" />
        </span>
        <button
          type="button"
          className={styles.close}
          aria-label="Close delete confirmation"
          onClick={() => onAnswer(false)}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <h2 id={`${id}-title`}>{prompt.title}</h2>
        {prompt.subject && <p className={styles.subject}>{prompt.subject}</p>}
        <p id={`${id}-description`}>{prompt.description}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            ref={cancelRef}
            autoFocus
            onClick={() => onAnswer(false)}
          >
            Keep record
          </button>
          <button
            type="button"
            className={styles.remove}
            onClick={() => onAnswer(true)}
          >
            <Trash2 size={16} aria-hidden="true" />
            {prompt.confirmLabel ?? "Delete record"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function useDeleteConfirmation() {
  const [prompt, setPrompt] = useState<DeletePrompt | null>(null);
  const resolve = useRef<((confirmed: boolean) => void) | null>(null);
  useEffect(
    () => () => {
      resolve.current?.(false);
      resolve.current = null;
    },
    [],
  );
  function confirmDelete(next: DeletePrompt): Promise<boolean> {
    if (resolve.current) return Promise.resolve(false);
    return new Promise((answer) => {
      resolve.current = answer;
      setPrompt(next);
    });
  }
  const dialog = prompt ? (
    <DeleteConfirmationDialog
      prompt={prompt}
      onAnswer={(confirmed) => {
        const answer = resolve.current;
        resolve.current = null;
        setPrompt(null);
        answer?.(confirmed);
      }}
    />
  ) : null;
  return { confirmDelete, deleteDialog: dialog };
}
