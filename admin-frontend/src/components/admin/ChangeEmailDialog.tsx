"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import {
  CircleAlert,
  CircleCheck,
  Clock3,
  LoaderCircle,
  Mail,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { createAccountClient } from "@/lib/accountAuth";
import {
  changeOwnEmail,
  EMAIL_CHANGE_PENDING_SECONDS,
  emailChangeFailure,
  getOwnEmailChange,
  normalizeEmail,
  validateEmailChange,
  type EmailErrors,
  type EmailValues,
  type EmailChangeAccount,
} from "@/lib/changeEmail";
import { AccountDialog } from "./AccountDialog";
import { SecretInput } from "./SecretInput";
import styles from "./ChangePasswordDialog.module.css";

export function ChangeEmailDialog({
  onClose,
  returnFocusRef,
}: {
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const inFlight = useRef(false);
  const focusTarget = useRef<string | null>(null);
  const accountId = useRef<string | undefined>(undefined);
  const requestedEmail = useRef<string | null>(null);
  const pendingWindow = useRef<{ email: string; until: number } | null>(null);
  const returnedPendingEmail = useRef<string | null>(null);
  const recheck = useRef<(() => void) | null>(null);
  const [account, setAccount] = useState<EmailChangeAccount | null>(null);
  const currentEmail = account?.currentEmail ?? "";
  const [checking, setChecking] = useState(true);
  const [statusNote, setStatusNote] = useState("");
  const [values, setValues] = useState<EmailValues>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<EmailErrors>({});
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingUntil, setPendingUntil] = useState(0);
  const [now, setNow] = useState(0);
  const remaining = Math.max(0, Math.ceil((pendingUntil - now) / 1000));
  const [saved, setSaved] = useState<"pending" | "confirmed" | null>(null);
  function returnToEmailForm(email: string) {
    if (returnedPendingEmail.current === email) return false;
    returnedPendingEmail.current = email;
    setSaved(null);
    setValues({ email: "", password: "" });
    setErrors({});
    setFeedback("");
    setStatusNote("");
    focusTarget.current = "email";
    return true;
  }
  useEffect(() => {
    let active = true;
    let loading = false;
    async function load(manual = false) {
      if (inFlight.current || loading) return;
      loading = true;
      setChecking(true);
      try {
        if (!supabase) throw Error();
        const latest = await getOwnEmailChange(
          supabase.auth,
          accountId.current,
        );
        if (!active) return;
        accountId.current = latest.userId;
        setAccount(latest);
        setFeedback("");
        if (latest.pendingEmail) {
          const email = normalizeEmail(latest.pendingEmail);
          const timestamp = Date.now();
          const until =
            latest.confirmationSentAt !== undefined
              ? latest.confirmationSentAt + EMAIL_CHANGE_PENDING_SECONDS * 1000
              : pendingWindow.current?.email === email
                ? pendingWindow.current.until
                : timestamp + EMAIL_CHANGE_PENDING_SECONDS * 1000;
          requestedEmail.current = email;
          pendingWindow.current = { email, until };
          setPendingUntil(until);
          setNow(timestamp);
          if (timestamp >= until || returnedPendingEmail.current === email) {
            // Focus/status checks must not restore the pending screen or erase
            // a draft after this request's waiting window has ended.
            returnToEmailForm(email);
          } else {
            setValues({ email: latest.pendingEmail, password: "" });
            setSaved("pending");
            setStatusNote(
              manual
                ? "Still waiting for confirmation. Open the latest link in your new inbox and check Spam."
                : "",
            );
          }
        } else if (requestedEmail.current) {
          if (normalizeEmail(latest.currentEmail) === requestedEmail.current) {
            pendingWindow.current = null;
            setSaved("confirmed");
            setValues({ email: latest.currentEmail, password: "" });
            setStatusNote("");
          } else {
            requestedEmail.current = null;
            pendingWindow.current = null;
            setSaved(null);
            setStatusNote(
              "No pending change was found. Your current sign-in email is shown below. You can request confirmation again.",
            );
          }
        }
      } catch (cause) {
        if (active) {
          setAccount(null);
          setFeedback(emailChangeFailure(cause).message);
        }
      } finally {
        loading = false;
        if (active) setChecking(false);
      }
    }
    const check = () => void load(true);
    const onReturn = () => {
      if (document.visibilityState === "visible") void load();
    };
    recheck.current = check;
    void load();
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      active = false;
      recheck.current = null;
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, []);
  useEffect(() => {
    if (saved !== "pending" || !pendingUntil) return;
    const tick = () => {
      const timestamp = Date.now();
      setNow(timestamp);
      const pending = pendingWindow.current;
      if (
        timestamp >= pendingUntil &&
        pending?.until === pendingUntil &&
        returnToEmailForm(pending.email)
      ) {
        // Read Auth once to recognize a confirmation made just before timeout.
        // Resetting this view must never mutate the account or send more mail.
        recheck.current?.();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [saved, pendingUntil]);
  useEffect(() => {
    if (!busy && !checking && focusTarget.current) {
      form.current
        ?.querySelector<HTMLElement>(`[data-focus="${focusTarget.current}"]`)
        ?.focus();
      focusTarget.current = null;
    }
  }, [busy, checking, errors, feedback, saved]);
  function edit(field: keyof EmailValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || checking || saved || !account) return;
    const invalid = validateEmailChange(values, currentEmail);
    setErrors(invalid);
    setFeedback("");
    const first = invalid.email
      ? "email"
      : invalid.password
        ? "password"
        : null;
    if (first) {
      focusTarget.current = first;
      return;
    }
    if (!supabase) {
      setFeedback("The account service is unavailable.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await changeOwnEmail(
        supabase.auth,
        () => createAccountClient("email-verification").auth,
        values,
        `${window.location.origin}/admin/login`,
      );
      requestedEmail.current = normalizeEmail(values.email);
      setValues({ email: normalizeEmail(values.email), password: "" });
      setStatusNote("");
      returnedPendingEmail.current = null;
      const timestamp = Date.now();
      const until =
        (result.confirmationSentAt ?? timestamp) +
        EMAIL_CHANGE_PENDING_SECONDS * 1000;
      pendingWindow.current = { email: requestedEmail.current, until };
      setPendingUntil(until);
      setNow(timestamp);
      setSaved(result.confirmed ? "confirmed" : "pending");
    } catch (cause) {
      const failure = emailChangeFailure(cause);
      if (failure.field) setErrors({ [failure.field]: failure.message });
      else setFeedback(failure.message);
      focusTarget.current = failure.field ?? "feedback";
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <AccountDialog
      title={
        saved
          ? saved === "pending"
            ? "Email change pending"
            : "Email updated"
          : "Change email"
      }
      icon={
        saved === "pending" ? (
          <Clock3 size={23} />
        ) : saved === "confirmed" ? (
          <CircleCheck size={23} />
        ) : (
          <Mail size={23} />
        )
      }
      busy={busy}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    >
      {saved === "pending" ? (
        <div className={styles.form} aria-busy={checking}>
          <div className={styles.fields}>
            <p className={styles.description}>
              Confirm the link in your new inbox to finish changing your email.
              If it is not confirmed within {EMAIL_CHANGE_PENDING_SECONDS} seconds,
              this window returns to the email form.
            </p>
            <p className={styles.accountEmail}>
              Current sign-in email
              <br />
              <strong>{currentEmail}</strong>
            </p>
            <p className={styles.accountEmail}>
              Email to confirm
              <br />
              <strong>{values.email}</strong>
            </p>
            <p className={styles.hint}>
              Check Spam if you cannot find the message. Keep using your current
              sign-in email until the change is confirmed.
            </p>
            <p className={styles.hint} role="timer" aria-live="off">
              Return to email form in {remaining}s.
            </p>
            {statusNote && (
              <p className={styles.notice} role="status">
                {statusNote}
              </p>
            )}
            {feedback && (
              <p className={styles.error} role="alert">
                <CircleAlert size={15} aria-hidden="true" />
                {feedback}
              </p>
            )}
          </div>
          <footer className={styles.actions}>
            <button
              type="button"
              className={styles.cancel}
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={checking}
              onClick={() => recheck.current?.()}
            >
              {checking && (
                <LoaderCircle
                  className={styles.spinner}
                  size={16}
                  aria-hidden="true"
                />
              )}
              {checking ? "Checking…" : "Check confirmation"}
            </button>
          </footer>
        </div>
      ) : saved === "confirmed" ? (
        <div className={styles.success}>
          <p role="status">
            Your email is now <strong>{values.email}</strong>. Use it with your
            existing password the next time you sign in.
          </p>
          <button
            type="button"
            className={styles.primary}
            onClick={onClose}
            autoFocus
          >
            Done
          </button>
        </div>
      ) : (
        <form
          ref={form}
          onSubmit={submit}
          noValidate
          className={styles.form}
          aria-busy={busy}
        >
          <div className={styles.fields}>
            <p className={styles.description}>
              Use an email inbox you control so you can receive password
              recovery codes.
            </p>
            {statusNote && (
              <p className={styles.notice} role="status">
                {statusNote}
              </p>
            )}
            <p className={styles.accountEmail}>
              Current email
              <br />
              <strong>{currentEmail || "Checking your account…"}</strong>
            </p>
            <div className={styles.field}>
              <label htmlFor={`${id}-email`}>New email address</label>
              <input
                id={`${id}-email`}
                data-focus="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={values.email}
                onChange={(event) => edit("email", event.target.value)}
                disabled={busy || checking || !currentEmail}
                required
                aria-invalid={Boolean(errors.email)}
                aria-describedby={
                  errors.email ? `${id}-email-error` : undefined
                }
              />
              {errors.email && (
                <p id={`${id}-email-error`} className={styles.error}>
                  {errors.email}
                </p>
              )}
            </div>
            <div className={styles.field}>
              <label htmlFor={`${id}-password`}>Current password</label>
              <SecretInput
                id={`${id}-password`}
                data-focus="password"
                secretLabel="password"
                autoComplete="current-password"
                value={values.password}
                onChange={(event) => edit("password", event.target.value)}
                disabled={busy || checking || !currentEmail}
                required
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? `${id}-password-error` : undefined
                }
              />
              {errors.password && (
                <p id={`${id}-password-error`} className={styles.error}>
                  {errors.password}
                </p>
              )}
            </div>
            <p className={styles.hint}>
              Enter your current password, then confirm the link sent to your
              new email. Your role and assigned barangay stay the same.
            </p>
            {feedback && (
              <p
                className={styles.error}
                data-focus="feedback"
                tabIndex={-1}
                role="alert"
              >
                <CircleAlert size={15} aria-hidden="true" />
                {feedback}
              </p>
            )}
          </div>
          <footer className={styles.actions}>
            <button
              type="button"
              className={styles.cancel}
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.primary}
              disabled={busy || checking || !currentEmail}
            >
              {busy && (
                <LoaderCircle
                  className={styles.spinner}
                  size={16}
                  aria-hidden="true"
                />
              )}
              {busy ? "Sending…" : "Send confirmation"}
            </button>
          </footer>
        </form>
      )}
    </AccountDialog>
  );
}
