"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { Brand } from "@/components/ui/Brand";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError(
        "Supabase isn't configured yet — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local."
      );
      return;
    }
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/admin/dashboard");
  }

  return (
    <main className="login-page">
      <header className="app-header"><Link href="/" aria-label="EvacuRosa public map"><Brand /></Link><span className="city-label">Santa Rosa, Laguna</span><Link href="/" className="admin-link">Back to public map →</Link></header>
      <div className="login-content">
      <form
        onSubmit={handleSubmit}
        className="login-card"
      >
        <span className="eyebrow">AUTHORIZED PERSONNEL</span>
        <h1>Welcome back</h1>
        <p className="login-intro">Sign in to your barangay or CDRRMO workspace to manage local emergency information.</p>
        <label htmlFor="admin-email">Email address</label>
        <input
          type="email"
          id="admin-email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <label htmlFor="admin-password">Password</label>
        <input
          type="password"
          id="admin-password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-4 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {error && <p className="error-message mb-3" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="primary-button"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="login-help">
          Access is limited to authorized barangay and CDRRMO personnel.
          Contact your system administrator if you need an account.
        </p>
      </form>
      </div>
    </main>
  );
}
