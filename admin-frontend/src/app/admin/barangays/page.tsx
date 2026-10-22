"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { SecretInput } from "@/components/admin/SecretInput";
import { BarangayEvacuationOverview } from "@/components/admin/BarangayEvacuationOverview";
import { supabase } from "@/lib/supabaseClient";
import { publicSans } from "@/app/fonts/publicSans";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type Barangay = { id: string; name: string };

export default function BarangaySelectionPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [selected, setSelected] = useState<Barangay | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadBarangays() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/admin/barangays`, {
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error ?? "Could not load barangays.");
      setBarangays(body.barangays);
    } catch {
      setError(
        "Could not load barangays. Check the backend connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      if (!supabase) {
        router.replace("/admin/login");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        router.replace("/admin/login");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (!active) return;
      if (profileError || !profile) {
        setReady(true);
        setError(
          "Could not verify your barangay account. Please sign in again.",
        );
        return;
      }
      if (profile.role !== "BARANGAY_ADMIN") {
        router.replace(
          profile.role === "SUPER_ADMIN" ? "/admin/dashboard" : "/admin/login",
        );
        return;
      }
      setReady(true);
      await loadBarangays();
    }
    void initialize().catch(() => {
      if (active) {
        setReady(true);
        setError("Could not verify your session. Please sign in again.");
      }
    });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (selected) {
      const input = document.getElementById("barangay-code");
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      input?.focus({ preventScroll: true });
    }
  }, [selected]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !supabase || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw Error("Your session expired. Sign in again.");
      const response = await fetch(`${API}/api/admin/barangay-login`, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barangayId: selected.id, code }),
      });
      const body = await response.json();
      if (!response.ok)
        throw Error(body.error ?? "Could not verify the barangay code.");
      // The backend verifies the code and returns a session scoped to this barangay.
      // The shared entry account itself never gains access to every center.
      const { error: sessionError } = await supabase.auth.setSession(body);
      if (sessionError) throw sessionError;
      setCode("");
      router.replace("/admin/dashboard");
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? "Cannot reach the backend. Check your connection and try again."
          : cause instanceof Error
            ? cause.message
            : "Could not verify the barangay code.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className={`staff-login barangay-access-page ${publicSans.className}`}
    >
      <header className="app-header">
        <Brand />
        <span>Barangay administration &middot; Santa Rosa, Laguna</span>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={async () => {
            await supabase?.auth.signOut();
            router.replace("/admin/login");
          }}
        >
          Sign out
        </button>
      </header>
      <div className="staff-login-content">
        <div className="staff-login-title">
          <span className="eyebrow">BARANGAY ACCESS</span>
          <h1>Barangay administration</h1>
          <p>
            View city evacuation centers, then choose your barangay and enter
            its private code to update occupancy and availability.
          </p>
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {!ready || loading ? (
          <p role="status">Loading barangays...</p>
        ) : (
          <>
            <BarangayEvacuationOverview />
            <h2 id="barangay-selection-title">Select your barangay</h2>
            <div
              className="barangay-access-grid"
              aria-labelledby="barangay-selection-title"
            >
              {barangays.map((barangay, index) => (
                <button
                  type="button"
                  key={barangay.id}
                  disabled={busy}
                  aria-pressed={selected?.id === barangay.id}
                  onClick={() => {
                    setSelected(barangay);
                    setCode("");
                    setError("");
                  }}
                >
                  <span className={`barangay-card-icon tone-${index % 4}`}>
                    <MapPin size={25} aria-hidden="true" />
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
                onClick={() => void loadBarangays()}
              >
                Retry loading barangays
              </button>
            )}
            {selected && (
              <form
                className="barangay-access-form"
                onSubmit={submit}
                aria-busy={busy}
              >
                <h2>{selected.name}</h2>
                <label htmlFor="barangay-code">Barangay access code</label>
                <SecretInput
                  key={selected.id}
                  id="barangay-code"
                  secretLabel="code"
                  autoComplete="off"
                  required
                  minLength={6}
                  maxLength={6}
                  pattern="[A-Za-z0-9]{6}"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={busy}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
                <p>
                  Enter the 6-character code issued specifically to{" "}
                  {selected.name}. Use letters or numbers. Letters are
                  case-sensitive.
                </p>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={busy}
                >
                  {busy ? "Verifying..." : "Open barangay dashboard"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
