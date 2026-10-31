"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import localFont from "next/font/local";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  Map as MapIcon,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Brand } from "@/components/ui/Brand";
import { SecretInput } from "@/components/admin/SecretInput";
import { LoginSlideshow } from "@/components/admin/LoginSlideshow";
import { useLoginViewport } from "@/hooks/useLoginViewport";
import { publicSans } from "@/app/fonts/publicSans";
import { rememberWorkspaceRole } from "@/lib/workspaceLoading";
import {
  signInFailure,
  validateLogin,
  type LoginFailure,
  type LoginField,
  type LoginFieldErrors,
} from "@/lib/loginFeedback";

const headlineFont = localFont({
  src: "../../fonts/BodoniModa-Variable.ttf",
  weight: "400 900",
  variable: "--font-login-display",
  display: "swap",
});

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<
    "idle" | "signing-in" | "verifying-access" | "redirecting"
  >("idle");
  const busy = stage !== "idle";
  const submissionInFlight = useRef(false);
  const [feedback, setFeedback] = useState<LoginFailure | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<LoginField, boolean>>>(
    {},
  );
  const [capsLock, setCapsLock] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  useLoginViewport(pageRef);
  const focusTarget = useRef<LoginFailure["focus"] | null>(null);

  // Focus after feedback is committed and the fields are re-enabled.
  useEffect(() => {
    if (busy || !focusTarget.current) return;
    const target = focusTarget.current;
    const element = formRef.current?.querySelector<HTMLElement>(
      target === "form" ? "#login-error" : `#admin-${target}`,
    );
    if (element) {
      focusTarget.current = null;
      element.focus({ preventScroll: true });
    }
  }, [busy, feedback, fieldErrors]);

  function focusFeedback(target: LoginFailure["focus"]) {
    focusTarget.current = target;
  }

  function showFailure(failure: LoginFailure) {
    setFeedback(failure);
    focusFeedback(failure.focus);
  }

  function updateField(field: LoginField, value: string) {
    if (field === "email") setEmail(value);
    else setPassword(value);
    setFieldErrors((current) => ({
      ...current,
      [field]:
        touched[field] || submitted
          ? validateLogin(
              field === "email" ? value : email,
              field === "password" ? value : password,
            )[field]
          : undefined,
    }));
    setFeedback(null);
  }

  function checkField(field: LoginField) {
    setTouched((current) => ({ ...current, [field]: true }));
    setFieldErrors((current) => ({
      ...current,
      [field]: validateLogin(email, password)[field],
    }));
  }

  function fieldDescription(field: LoginField) {
    return fieldErrors[field]
      ? `admin-${field}-error`
      : feedback?.invalidFields.includes(field)
        ? "login-error"
        : undefined;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submissionInFlight.current) return;
    setSubmitted(true);
    setFeedback(null);
    const errors = validateLogin(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      focusFeedback(errors.email ? "email" : "password");
      return;
    }
    if (!supabase) {
      showFailure({
        message:
          "Sign-in is unavailable right now. Contact your CDRRMO administrator.",
        invalidFields: [],
        focus: "form",
      });
      return;
    }
    submissionInFlight.current = true;
    setStage("signing-in");
    let openingWorkspace = false;
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: email.trim(),
          password,
        },
      );
      if (authError) {
        showFailure(signInFailure(authError));
        return;
      }
      if (!data.user || !data.session) {
        showFailure(signInFailure(null));
        return;
      }
      setStage("verifying-access");
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, barangay_id")
        .eq("id", data.user.id)
        .maybeSingle();
      let accessError = "";
      if (profileError) {
        accessError =
          "Could not verify your admin access. Please try again. If this continues, contact your CDRRMO administrator.";
      } else if (
        profile?.role !== "SUPER_ADMIN" &&
        profile?.role !== "BARANGAY_ADMIN"
      ) {
        accessError =
          "Your account does not have admin access. Contact your CDRRMO administrator.";
      }
      if (accessError) {
        await supabase.auth.signOut();
        showFailure({ message: accessError, invalidFields: [], focus: "form" });
        return;
      }
      rememberWorkspaceRole(profile!.role, data.user.id);
      setPassword("");
      setStage("redirecting");
      router.replace(
        profile?.role === "BARANGAY_ADMIN"
          ? "/admin/barangays"
          : "/admin/dashboard",
      );
      openingWorkspace = true;
    } catch (e) {
      showFailure(signInFailure(e));
    } finally {
      if (!openingWorkspace) {
        submissionInFlight.current = false;
        setStage("idle");
      }
    }
  }

  return (
    <main
      ref={pageRef}
      className={`admin-login-page ${publicSans.className} ${headlineFont.variable}`}
    >
      <LoginSlideshow />
      <header className="login-masthead">
        <Brand />
        <div className="login-masthead-actions">
          <span className="login-portal-label">ADMINISTRATION PORTAL</span>
          {process.env.NEXT_PUBLIC_PUBLIC_APP_URL && (
            <a
              className="login-public-link"
              href={process.env.NEXT_PUBLIC_PUBLIC_APP_URL}
              aria-label="Open public evacuation map"
            >
              <MapIcon
                className="login-public-icon"
                size={16}
                aria-hidden="true"
              />
              <span>Public map</span>
              <ArrowUpRight
                className="login-public-arrow"
                size={15}
                aria-hidden="true"
              />
            </a>
          )}
        </div>
      </header>
      <div className="login-layout">
        <section
          className="login-introduction"
          aria-labelledby="login-introduction-title"
        >
          <p className="login-city">
            <MapPin size={14} aria-hidden="true" />
            Santa Rosa City, Laguna
          </p>
          <h1 id="login-introduction-title">
            Ready to <br />
            respond.
          </h1>
          <p className="login-introduction-copy">
            A shared space for city response and barangay evacuation updates.
          </p>
          <div className="login-workspaces" aria-label="Staff workspaces">
            <span>
              <ShieldCheck size={16} aria-hidden="true" />
              CDRRMO
            </span>
            <span>
              <Building2 size={16} aria-hidden="true" />
              Barangay
            </span>
          </div>
        </section>
        <section className="login-panel" aria-labelledby="staff-sign-in-title">
          <div className="login-panel-kicker">
            <LockKeyhole size={14} aria-hidden="true" />
            AUTHORIZED PERSONNEL
          </div>
          <h2 id="staff-sign-in-title">Staff sign in</h2>
          <p className="login-panel-description">
            Enter your account details to open your workspace.
          </p>
          <form
            ref={formRef}
            noValidate
            className="login-credentials"
            onSubmit={submit}
            aria-busy={busy}
          >
            <div className="login-field">
              <label htmlFor="admin-email">Email address</label>
              <input
                id="admin-email"
                name="email"
                type="email"
                enterKeyHint="next"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    formRef.current
                      ?.querySelector<HTMLInputElement>("#admin-password")
                      ?.focus({ preventScroll: true });
                  }
                }}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={busy}
                value={email}
                onChange={(e) => updateField("email", e.target.value)}
                onBlur={() => checkField("email")}
                aria-invalid={Boolean(
                  fieldErrors.email ||
                  feedback?.invalidFields.includes("email"),
                )}
                aria-describedby={fieldDescription("email")}
                placeholder="you@example.com"
              />
              {fieldErrors.email && (
                <p id="admin-email-error" className="login-field-error">
                  <CircleAlert size={13} aria-hidden="true" />
                  {fieldErrors.email}
                </p>
              )}
            </div>
            <div className="login-field">
              <label htmlFor="admin-password">Password</label>
              <SecretInput
                id="admin-password"
                name="password"
                secretLabel="password"
                enterKeyHint="go"
                retainInputFocus
                autoComplete="current-password"
                required
                disabled={busy}
                value={password}
                onChange={(e) => updateField("password", e.target.value)}
                onKeyUp={(event) =>
                  setCapsLock(event.getModifierState("CapsLock"))
                }
                onBlur={() => {
                  setCapsLock(false);
                  checkField("password");
                }}
                aria-invalid={Boolean(
                  fieldErrors.password ||
                  feedback?.invalidFields.includes("password"),
                )}
                aria-describedby={
                  [
                    fieldDescription("password"),
                    capsLock ? "login-caps-lock" : null,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                placeholder="Enter your password"
              />
              {capsLock && (
                <p
                  id="login-caps-lock"
                  className="login-field-hint"
                  role="status"
                >
                  Caps Lock is on.
                </p>
              )}
              {fieldErrors.password && (
                <p id="admin-password-error" className="login-field-error">
                  <CircleAlert size={13} aria-hidden="true" />
                  {fieldErrors.password}
                </p>
              )}
            </div>
            {feedback && (
              <div
                id="login-error"
                className="login-error"
                role="alert"
                tabIndex={-1}
              >
                <CircleAlert size={16} aria-hidden="true" />
                <span>{feedback.message}</span>
              </div>
            )}
            <button type="submit" className="login-submit" disabled={busy}>
              <span aria-live="polite" aria-atomic="true">
                {stage === "signing-in"
                  ? "Signing in…"
                  : stage === "verifying-access"
                    ? "Checking access…"
                    : stage === "redirecting"
                      ? "Opening workspace…"
                      : "Sign in"}
              </span>
              {busy ? (
                <LoaderCircle
                  className="login-progress"
                  size={18}
                  aria-hidden="true"
                />
              ) : (
                <ArrowRight size={18} aria-hidden="true" />
              )}
            </button>
          </form>
        </section>
      </div>
      <footer className="login-footer">
        <span>EvacuRosa &middot; Santa Rosa, Laguna</span>
        <span>Community preparedness. Coordinated action.</span>
      </footer>
    </main>
  );
}
