"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { createClient } from "@supabase/supabase-js";
import {
  CircleAlert,
  CircleCheck,
  KeyRound,
  LoaderCircle,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  changeOwnPassword,
  passwordChangeFailure,
  validatePasswordChange,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
  type PasswordErrors,
  type PasswordField,
  type PasswordValues,
} from "@/lib/changePassword";
import { SecretInput } from "./SecretInput";
import styles from "./ChangePasswordDialog.module.css";

const emptyValues: PasswordValues = { current: "", next: "", confirm: "" };

export function ChangePasswordDialog({
  onClose,
  returnFocusRef,
}: {
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const saving = useRef(false);
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const focusTarget = useRef<PasswordField | "feedback" | null>(null);

  useEffect(() => {
    const element = dialog.current;
    const opener = returnFocusRef?.current ?? document.activeElement;
    element?.showModal();
    form.current
      ?.querySelector<HTMLInputElement>("input")
      ?.focus({ preventScroll: true });
    return () => {
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, [returnFocusRef]);

  useEffect(() => {
    if (busy) return;
    if (saved)
      dialog.current?.querySelector<HTMLButtonElement>("[data-done]")?.focus();
    else if (focusTarget.current) {
      dialog.current
        ?.querySelector<HTMLElement>(`[data-focus="${focusTarget.current}"]`)
        ?.focus();
      focusTarget.current = null;
    }
  }, [busy, saved, errors, feedback]);

  function close() {
    if (!saving.current) onClose();
  }

  function edit(field: PasswordField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current || saved) return;
    const invalid = validatePasswordChange(values);
    setErrors(invalid);
    setFeedback("");
    const first = (["current", "next", "confirm"] as const).find(
      (field) => invalid[field],
    );
    if (first) {
      focusTarget.current = first;
      return;
    }
    if (!supabase) {
      setFeedback(
        "The account service is unavailable. Please try again later.",
      );
      focusTarget.current = "feedback";
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      await changeOwnPassword(
        supabase.auth,
        () =>
          createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
              auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                storageKey: "evacurosa-password-verification",
              },
            },
          ).auth,
        values,
      );
      setValues(emptyValues);
      setSaved(true);
    } catch (error) {
      const failure = passwordChangeFailure(error);
      if (failure.field) setErrors({ [failure.field]: failure.message });
      else setFeedback(failure.message);
      focusTarget.current = failure.field ?? "feedback";
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className={styles.content}>
        <header className={styles.heading}>
          <span className={styles.icon}>
            {saved ? <CircleCheck size={23} /> : <KeyRound size={23} />}
          </span>
          <div>
            <p className={styles.eyebrow}>YOUR ACCOUNT</p>
            <h2 id={`${id}-title`}>
              {saved ? "Password changed" : "Change password"}
            </h2>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Close change password"
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        {saved ? (
          <div className={styles.success}>
            <p id={`${id}-description`} role="status">
              Your new password is saved. Use it the next time you sign in.
            </p>
            <button
              type="button"
              className={styles.primary}
              data-done
              onClick={close}
            >
              Done
            </button>
          </div>
        ) : (
          <form
            ref={form}
            className={styles.form}
            onSubmit={submit}
            noValidate
            aria-busy={busy}
          >
            <div className={styles.fields}>
              <p id={`${id}-description`} className={styles.description}>
                Update the password for your signed-in account.
              </p>
              {(
                [
                  ["current", "Current password"],
                  ["next", "New password"],
                  ["confirm", "Confirm new password"],
                ] as const
              ).map(([field, label]) => (
                <div className={styles.field} key={field}>
                  <label htmlFor={`${id}-${field}`}>{label}</label>
                  <SecretInput
                    id={`${id}-${field}`}
                    name={
                      field === "current"
                        ? "current-password"
                        : field === "next"
                          ? "new-password"
                          : "confirm-password"
                    }
                    secretLabel="password"
                    autoComplete={
                      field === "current" ? "current-password" : "new-password"
                    }
                    value={values[field]}
                    onChange={(event) => edit(field, event.target.value)}
                    disabled={busy}
                    required
                    minLength={
                      field === "current" ? undefined : PASSWORD_MIN_LENGTH
                    }
                    data-focus={field}
                    aria-invalid={Boolean(errors[field])}
                    aria-describedby={
                      [
                        field === "next" ? `${id}-hint` : "",
                        errors[field] ? `${id}-${field}-error` : "",
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                  />
                  {field === "next" && (
                    <p id={`${id}-hint`} className={styles.hint}>
                      {PASSWORD_REQUIREMENTS}
                    </p>
                  )}
                  {errors[field] && (
                    <p id={`${id}-${field}-error`} className={styles.error}>
                      <CircleAlert size={15} aria-hidden="true" />
                      {errors[field]}
                    </p>
                  )}
                </div>
              ))}
              {feedback && (
                <p
                  className={styles.error}
                  role="alert"
                  tabIndex={-1}
                  data-focus="feedback"
                >
                  <CircleAlert size={17} aria-hidden="true" />
                  {feedback}
                </p>
              )}
            </div>
            <footer className={styles.actions}>
              <button
                type="button"
                className={styles.cancel}
                disabled={busy}
                onClick={close}
              >
                Cancel
              </button>
              <button type="submit" className={styles.primary} disabled={busy}>
                {busy && (
                  <LoaderCircle
                    size={17}
                    className={styles.spinner}
                    aria-hidden="true"
                  />
                )}
                <span aria-live="polite">
                  {busy ? "Saving…" : "Save password"}
                </span>
              </button>
            </footer>
          </form>
        )}
      </div>
    </dialog>
  );
}
