"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Brand } from "@/components/ui/Brand";
import { SecretInput } from "@/components/admin/SecretInput";

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
    <main className="staff-login">
      <header className="app-header">
        <Brand />
        <span>Administration &middot; Santa Rosa, Laguna</span>
      </header>
      <div className="staff-login-content staff-credentials-login">
        <form
          className="barangay-access-form"
          onSubmit={submit}
          aria-busy={busy}
        >
          <div className="staff-login-title">
            <ShieldCheck size={32} aria-hidden="true" />
            <span className="eyebrow">AUTHORIZED PERSONNEL</span>
            <h1>Welcome back</h1>
            <p>Sign in with your CDRRMO or barangay admin account.</p>
          </div>
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
          />
          <label htmlFor="admin-password">Password</label>
          <SecretInput
            id="admin-password"
            secretLabel="password"
            autoComplete="current-password"
            required
            disabled={busy}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
          <p>
            CDRRMO opens the city dashboard. Barangay staff select their
            barangay and verify its access code.
          </p>
        </form>
      </div>
    </main>
  );
}
