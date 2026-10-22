"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/ui/Brand";
import { BarangayAccessDialog } from "@/components/admin/BarangayAccessDialog";
import { BarangayEvacuationOverview } from "@/components/admin/BarangayEvacuationOverview";
import { BarangayAccessCard } from "@/components/admin/BarangayAccessCard";
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
  const [accessError, setAccessError] = useState("");

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !supabase || busy) return;
    if (!/^[A-Za-z0-9]{6}$/.test(code)) {
      setAccessError("Enter all 6 characters using letters or numbers.");
      document.getElementById("barangay-code")?.focus({ preventScroll: true });
      return;
    }
    setBusy(true);
    setAccessError("");
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
      setAccessError(
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
              {barangays.map((barangay) => (
                <BarangayAccessCard
                  key={barangay.id}
                  barangay={barangay}
                  disabled={busy}
                  selected={selected?.id === barangay.id}
                  onSelect={() => {
                    setSelected(barangay);
                    setCode("");
                    setAccessError("");
                  }}
                />
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
              <BarangayAccessDialog
                key={selected.id}
                barangay={selected}
                code={code}
                busy={busy}
                error={accessError}
                onSubmit={submit}
                onCodeChange={(value) => {
                  setCode(value);
                  setAccessError("");
                }}
                onClose={() => {
                  if (busy) return;
                  setSelected(null);
                  setCode("");
                  setAccessError("");
                }}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
