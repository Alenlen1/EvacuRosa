"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import localFont from "next/font/local";
import { ArrowRight, CircleAlert, LockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Brand } from "@/components/ui/Brand";
import { SecretInput } from "@/components/admin/SecretInput";
import { LoginSlideshow } from "@/components/admin/LoginSlideshow";
import { useLoginViewport } from "@/hooks/useLoginViewport";
import { publicSans } from "@/app/fonts/publicSans";
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
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<LoginFailure | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
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
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback(null);
  }

  function checkField(field: LoginField) {
    if (submitted)
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
    if (busy) return;
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
    setBusy(true);
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
      setPassword("");
      router.replace(
        profile?.role === "BARANGAY_ADMIN"
          ? "/admin/barangays"
          : "/admin/dashboard",
      );
    } catch (e) {
      showFailure(signInFailure(e));
    } finally {
      setBusy(false);
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
        <span className="login-portal-label">ADMINISTRATION PORTAL</span>
      </header>
      <div className="login-layout">
        <section
          className="login-introduction"
          aria-labelledby="login-introduction-title"
        >
          <p className="login-city">Santa Rosa City, Laguna</p>
          <h1 id="login-introduction-title">
            Ready to <br />
            respond.
          </h1>
          <p className="login-introduction-copy">
            Manage evacuation centers, monitor reported hazards, and coordinate
            assistance for your community.
          </p>
          <p className="login-introduction-note">
            One city. A coordinated response.
          </p>
        </section>
        <section className="login-panel" aria-labelledby="staff-sign-in-title">
          <div className="login-panel-kicker">
            <LockKeyhole size={14} aria-hidden="true" />
            AUTHORIZED PERSONNEL
          </div>
          <h2 id="staff-sign-in-title">Staff sign in</h2>
          <p className="login-panel-description">
            Welcome back. Sign in to your CDRRMO or barangay workspace.
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
                onBlur={() => checkField("password")}
                aria-invalid={Boolean(
                  fieldErrors.password ||
                  feedback?.invalidFields.includes("password"),
                )}
                aria-describedby={fieldDescription("password")}
                placeholder="Enter your password"
              />
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
              <span>{busy ? "Signing in…" : "Sign in"}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
          <div className="login-access-note">
            <p>Need access to your workspace?</p>
            <span>Contact your CDRRMO administrator.</span>
          </div>
          <p className="login-panel-footnote">
            For authorized CDRRMO and barangay personnel.
          </p>
        </section>
      </div>
      <footer className="login-footer">
        <span>EvacuRosa &middot; Santa Rosa, Laguna</span>
        <span>Community preparedness. Coordinated action.</span>
      </footer>
    </main>
  );
}
