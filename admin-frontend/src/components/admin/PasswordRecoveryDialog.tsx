"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { CircleAlert, CircleCheck, KeyRound, LoaderCircle } from "lucide-react";
import { closeAccountClient, createAccountClient } from "@/lib/accountAuth";
import { normalizeEmail } from "@/lib/changeEmail";
import {
  verifyPasswordRecoveryLink,
  type RecoveryLink,
} from "@/lib/passwordRecoveryLink";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
} from "@/lib/changePassword";
import {
  RECOVERY_RESEND_SECONDS,
  recoveryFailure,
  requestRecoveryCode,
  resetRecoveredPassword,
  validateRecoveryEmail,
  validateRecoveryPassword,
  verifyRecoveryCode,
  type RecoveryErrors,
} from "@/lib/passwordRecovery";
import { AccountDialog } from "./AccountDialog";
import { SecretInput } from "./SecretInput";
import styles from "./ChangePasswordDialog.module.css";

type Stage = "email" | "code" | "link" | "password" | "done";
export function PasswordRecoveryDialog({
  initialEmail,
  onClose,
  returnFocusRef,
  recoveryLink,
}: {
  initialEmail: string;
  onClose: (email?: string) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  recoveryLink?: RecoveryLink | null;
}) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const client = useRef<ReturnType<typeof createAccountClient> | null>(null);
  const verifiedId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const focusTarget = useRef<string | null>(null);
  const [stage, setStage] = useState<Stage>(recoveryLink ? "link" : "email");
  const linkAttempt = useRef<ReturnType<
    typeof verifyPasswordRecoveryLink
  > | null>(null);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<RecoveryErrors>({});
  const [feedback, setFeedback] = useState("");
  const [operation, setOperation] = useState<
    "sending" | "verifying" | "saving" | null
  >(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const busy = stage === "link" || operation !== null;
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));

  function release() {
    const current = client.current;
    client.current = null;
    verifiedId.current = null;
    if (current) return closeAccountClient(current);
    return Promise.resolve();
  }
  useEffect(() => {
    if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
    return () => {
      // Strict Mode replays effects. Release only after a real unmount, so its
      // replay cannot revoke the reset-link session that is being verified.
      cleanupTimer.current = setTimeout(() => void release(), 0);
    };
  }, []);
  useEffect(() => {
    if (!recoveryLink) return;
    let active = true;
    linkAttempt.current ??= Promise.resolve().then(() =>
      verifyPasswordRecoveryLink(getClient().auth, recoveryLink),
    );
    void linkAttempt.current
      .then(({ userId, email: verifiedEmail }) => {
        if (!active) return;
        verifiedId.current = userId;
        setEmail(verifiedEmail);
        focusTarget.current = "next";
        setStage("password");
      })
      .catch((cause: unknown) => {
        if (active) failure(cause, "link");
      });
    return () => {
      active = false;
    };
  }, [recoveryLink]);
  useEffect(() => {
    if (stage !== "code" || !resendAt) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= resendAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [stage, resendAt]);
  useEffect(() => {
    if (!busy && focusTarget.current) {
      form.current
        ?.querySelector<HTMLElement>(`[data-focus="${focusTarget.current}"]`)
        ?.focus();
      focusTarget.current = null;
    }
  }, [busy, stage, errors, feedback]);

  function getClient() {
    return (client.current ??= createAccountClient("recovery"));
  }
  function failure(cause: unknown, failedStage: Exclude<Stage, "done">) {
    const result = recoveryFailure(cause, failedStage);
    if (result.restart || failedStage === "link") {
      void release();
      setCode("");
      setNext("");
      setConfirm("");
      setStage("email");
    }
    if (result.field) setErrors({ [result.field]: result.message });
    else setFeedback(result.message);
    focusTarget.current = result.field ?? "feedback";
  }
  async function send(resend = false) {
    if (inFlight.current || (resend && Date.now() < resendAt)) return;
    const invalid = validateRecoveryEmail(email);
    setErrors(invalid ? { email: invalid } : {});
    setFeedback("");
    if (invalid) {
      focusTarget.current = "email";
      return;
    }
    inFlight.current = true;
    setOperation("sending");
    try {
      await requestRecoveryCode(
        getClient().auth,
        email,
        `${window.location.origin}/admin/login?recovery=1`,
      );
      setEmail(normalizeEmail(email));
      setCode("");
      setResendAt(Date.now() + RECOVERY_RESEND_SECONDS * 1000);
      setNow(Date.now());
      focusTarget.current = "code";
      setStage("code");
    } catch (cause) {
      failure(cause, "email");
    } finally {
      inFlight.current = false;
      setOperation(null);
    }
  }
  async function verify() {
    if (inFlight.current) return;
    if (!/^\d{6}$/.test(code)) {
      setErrors({ code: "Enter the 6-digit code from your latest email." });
      focusTarget.current = "code";
      return;
    }
    inFlight.current = true;
    setOperation("verifying");
    setErrors({});
    setFeedback("");
    try {
      verifiedId.current = await verifyRecoveryCode(
        getClient().auth,
        email,
        code,
      );
      setCode("");
      focusTarget.current = "next";
      setStage("password");
    } catch (cause) {
      failure(cause, "code");
    } finally {
      inFlight.current = false;
      setOperation(null);
    }
  }
  async function save() {
    if (inFlight.current) return;
    const invalid = validateRecoveryPassword(next, confirm);
    setErrors(invalid);
    setFeedback("");
    const first = invalid.next ? "next" : invalid.confirm ? "confirm" : null;
    if (first) {
      focusTarget.current = first;
      return;
    }
    inFlight.current = true;
    setOperation("saving");
    try {
      await resetRecoveredPassword(
        getClient().auth,
        verifiedId.current ?? "",
        next,
        confirm,
      );
      setNext("");
      setConfirm("");
      await release();
      setStage("done");
    } catch (cause) {
      failure(cause, "password");
    } finally {
      inFlight.current = false;
      setOperation(null);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (stage === "email") void send();
    else if (stage === "code") void verify();
    else if (stage === "password") void save();
  }
  function changed() {
    setErrors({});
    setFeedback("");
  }
  function error(field: keyof RecoveryErrors) {
    return errors[field] ? (
      <p className={styles.error} id={`${id}-${field}-error`}>
        {errors[field]}
      </p>
    ) : null;
  }
  return (
    <AccountDialog
      title={stage === "done" ? "Password reset" : "Reset your password"}
      icon={
        stage === "done" ? <CircleCheck size={23} /> : <KeyRound size={23} />
      }
      busy={busy}
      onClose={() => onClose()}
      returnFocusRef={returnFocusRef}
    >
      {stage === "link" ? (
        <div className={styles.success} role="status" aria-live="polite">
          <LoaderCircle className={styles.spinner} size={24} aria-hidden="true" />
          <p>Checking your reset link…</p>
        </div>
      ) : stage === "done" ? (
        <div className={styles.success}>
          <p role="status">
            Your password has been updated. Sign in with your email and new
            password.
          </p>
          <button
            type="button"
            className={styles.primary}
            onClick={() => onClose(email)}
            autoFocus
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <form
          ref={form}
          noValidate
          className={styles.form}
          onSubmit={submit}
          aria-busy={busy}
        >
          <div className={styles.fields}>
            <ol
              className={styles.recoverySteps}
              aria-label="Password recovery steps"
            >
              {(
                [
                  ["email", "Email"],
                  ["code", "Verify"],
                  ["password", "New password"],
                ] as const
              ).map(([key, label]) => (
                <li key={key} aria-current={stage === key ? "step" : undefined}>
                  {label}
                </li>
              ))}
            </ol>
            {stage === "email" ? (
              <>
                <p className={styles.description}>
                  Enter your registered email address. We’ll send a code so you
                  can choose a new password.
                </p>
                <div className={styles.field}>
                  <label htmlFor={`${id}-email`}>Email address</label>
                  <input
                    id={`${id}-email`}
                    data-focus="email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    disabled={busy}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      changed();
                    }}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={
                      errors.email ? `${id}-email-error` : undefined
                    }
                  />
                  {error("email")}
                </div>
                <p className={styles.hint}>
                  Use the address saved on your account. If you cannot access
                  that inbox, contact your system operator.
                </p>
              </>
            ) : stage === "code" ? (
              <>
                <p className={styles.notice} role="status">
                  If an account can receive recovery email at{" "}
                  <strong>{email}</strong>, a code has been sent. Check your
                  inbox and spam folder.
                </p>
                <div className={styles.field}>
                  <label htmlFor={`${id}-code`}>Verification code</label>
                  <input
                    id={`${id}-code`}
                    data-focus="code"
                    className={styles.codeInput}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={code}
                    onChange={(event) => {
                      setCode(
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      );
                      changed();
                    }}
                    required
                    disabled={busy}
                    aria-invalid={Boolean(errors.code)}
                    aria-describedby={`${id}-code-hint${errors.code ? ` ${id}-code-error` : ""}`}
                  />
                  <p id={`${id}-code-hint`} className={styles.hint}>
                    Enter the 6-digit code from your latest email. Codes expire
                    and can only be used once.
                  </p>
                  {error("code")}
                </div>
                <div className={styles.inlineActions}>
                  <button
                    type="button"
                    className={styles.textAction}
                    disabled={busy || remaining > 0}
                    onClick={() => void send(true)}
                  >
                    {operation === "sending"
                      ? "Sending…"
                      : remaining
                        ? `Resend in ${remaining}s`
                        : "Resend code"}
                  </button>
                  <button
                    type="button"
                    className={styles.textAction}
                    disabled={busy}
                    onClick={() => {
                      void release();
                      setCode("");
                      changed();
                      focusTarget.current = "email";
                      setStage("email");
                    }}
                  >
                    Use another email
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.description}>
                  Email verified. Choose a new password for your account.
                </p>
                {(
                  [
                    ["next", "New password", next, setNext],
                    ["confirm", "Confirm new password", confirm, setConfirm],
                  ] as const
                ).map(([field, label, value, setValue]) => (
                  <div className={styles.field} key={field}>
                    <label htmlFor={`${id}-${field}`}>{label}</label>
                    <SecretInput
                      id={`${id}-${field}`}
                      data-focus={field}
                      secretLabel="password"
                      autoComplete="new-password"
                      minLength={PASSWORD_MIN_LENGTH}
                      required
                      disabled={busy}
                      value={value}
                      onChange={(event) => {
                        setValue(event.target.value);
                        changed();
                      }}
                      aria-invalid={Boolean(errors[field])}
                      aria-describedby={
                        `${field === "next" ? `${id}-requirements` : ""}${errors[field] ? ` ${id}-${field}-error` : ""}`.trim() ||
                        undefined
                      }
                    />
                    {field === "next" && (
                      <p id={`${id}-requirements`} className={styles.hint}>
                        {PASSWORD_REQUIREMENTS}
                      </p>
                    )}
                    {error(field)}
                  </div>
                ))}
              </>
            )}
            {feedback && (
              <p
                className={styles.error}
                role="alert"
                tabIndex={-1}
                data-focus="feedback"
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
              onClick={() => onClose()}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={busy}>
              {busy && (
                <LoaderCircle
                  className={styles.spinner}
                  size={16}
                  aria-hidden="true"
                />
              )}
              {operation === "sending"
                ? "Sending…"
                : operation === "verifying"
                  ? "Verifying…"
                  : operation === "saving"
                    ? "Saving…"
                    : stage === "email"
                      ? "Send recovery code"
                      : stage === "code"
                        ? "Verify code"
                        : "Save new password"}
            </button>
          </footer>
        </form>
      )}
    </AccountDialog>
  );
}
