"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Brand } from "@/components/ui/Brand";
import { SecretInput } from "@/components/admin/SecretInput";
import { LoginSlideshow } from "@/components/admin/LoginSlideshow";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!supabase) {
      setError("Admin authentication is not configured.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: email.trim(),
          password,
        },
      );
      if (authError) throw authError;
      if (!data.user || !data.session)
        throw Error("Sign-in failed. Try again.");
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, barangay_id")
        .eq("id", data.user.id)
        .maybeSingle();
      let accessError = "";
      if (profileError) {
        accessError =
          "Could not verify your admin access. Please sign in again.";
      } else if (
        profile?.role !== "SUPER_ADMIN" &&
        profile?.role !== "BARANGAY_ADMIN"
      ) {
        accessError =
          "An authorized CDRRMO or barangay admin account is required.";
      }
      if (accessError) {
        await supabase.auth.signOut();
        throw Error(accessError);
      }
      setPassword("");
      router.replace(
        profile?.role === "BARANGAY_ADMIN"
          ? "/admin/barangays"
          : "/admin/dashboard",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
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
          <p className="login-city">
            <span />
            Santa Rosa City, Laguna
          </p>
          <h1 id="login-introduction-title">
            Ready to
            <br />
            respond.
          </h1>
          <p className="login-introduction-copy">
            Manage evacuation centers, monitor reported hazards, and coordinate
            assistance for your community.
          </p>
          <span className="login-introduction-rule" />
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
            className="login-credentials"
            onSubmit={submit}
            aria-busy={busy}
          >
            <div className="login-field">
              <label htmlFor="admin-email">Email address</label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={busy}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="login-field">
              <label htmlFor="admin-password">Password</label>
              <SecretInput
                id="admin-password"
                secretLabel="password"
                autoComplete="current-password"
                required
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
            {error && (
              <div className="login-error" role="alert">
                {error}
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
