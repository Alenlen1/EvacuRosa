"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ShieldCheck, Building2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Brand } from "@/components/ui/Brand";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type Barangay = { id: string; name: string };
export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"barangay" | "cdrrmo">("barangay");
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [selected, setSelected] = useState<Barangay | null>(null);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (selected && mode === "barangay")
      document.getElementById("barangay-code")?.focus();
  }, [selected, mode]);
  async function loadBarangays() {
    try {
      const r = await fetch(`${API}/api/admin/barangays`, {
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error ?? "Could not load barangays.");
      setBarangays(b.barangays);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load barangays.");
    }
  }
  useEffect(() => {
    void loadBarangays();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setError("Admin authentication is not configured.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "barangay") {
        if (!selected) throw Error("Select your barangay.");
        const response = await fetch(`${API}/api/admin/barangay-login`, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({ barangayId: selected.id, code }),
        });
        const body = await response.json();
        if (!response.ok) throw Error(body.error ?? "Sign-in failed.");
        const { error } = await supabase.auth.setSession(body);
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        const { data: session } = await supabase.auth.getSession();
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.session!.user.id)
          .single();
        if (profile?.role !== "SUPER_ADMIN") {
          await supabase.auth.signOut();
          throw Error("CDRRMO staff access is required.");
        }
      }
      setCode("");
      setPassword("");
      router.replace("/admin/dashboard");
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
        <span>Administration · Santa Rosa, Laguna</span>
      </header>
      <div className="staff-login-content">
        <div className="staff-login-title">
          <span className="eyebrow">AUTHORIZED PERSONNEL</span>
          <h1>EvacuRosa workspaces</h1>
          <p>
            Choose your barangay to update assigned shelters, or sign in to the
            CDRRMO workspace.
          </p>
        </div>
        <div
          className="staff-login-tabs"
          role="group"
          aria-label="Workspace type"
        >
          {(["barangay", "cdrrmo"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              disabled={busy}
              onClick={() => {
                setMode(value);
                setError("");
                setCode("");
              }}
            >
              {value === "barangay" ? (
                <Building2 size={20} />
              ) : (
                <ShieldCheck size={20} />
              )}{" "}
              {value === "barangay" ? "Barangay access" : "CDRRMO sign in"}
            </button>
          ))}
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {mode === "barangay" ? (
          <>
            <h2>Select your barangay</h2>
            <div className="barangay-access-grid">
              {barangays.map((barangay, index) => (
                <button
                  type="button"
                  key={barangay.id}
                  aria-pressed={selected?.id === barangay.id}
                  disabled={busy}
                  onClick={() => {
                    setSelected(barangay);
                    setCode("");
                    setError("");
                  }}
                >
                  <span className={`barangay-card-icon tone-${index % 4}`}>
                    <MapPin size={25} />
                  </span>
                  <span>
                    <strong>{barangay.name}</strong>
                    <small>Barangay workspace</small>
                  </span>
                </button>
              ))}
            </div>
            {!barangays.length && (
              <button
                className="secondary-button"
                onClick={() => {
                  setError("");
                  void loadBarangays();
                }}
              >
                Load barangays
              </button>
            )}
            {selected && (
              <form className="barangay-access-form" onSubmit={submit}>
                <h2>{selected.name}</h2>
                <label htmlFor="barangay-code">Barangay access code</label>
                <input
                  id="barangay-code"
                  type="password"
                  autoComplete="current-password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  minLength={12}
                  maxLength={128}
                />
                <p>
                  Use the private code issued to your barangay. Never share it
                  publicly.
                </p>
                <button disabled={busy} className="primary-button">
                  {busy ? "Verifying..." : "Open barangay dashboard"}
                </button>
              </form>
            )}
          </>
        ) : (
          <form className="barangay-access-form" onSubmit={submit}>
            <h2>CDRRMO sign in</h2>
            <label htmlFor="admin-email">Email address</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="primary-button" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
