"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, X } from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { BarangayAccessDialog } from "@/components/admin/BarangayAccessDialog";
import { BarangayEvacuationOverview } from "@/components/admin/BarangayEvacuationOverview";
import { BarangayAccessCard } from "@/components/admin/BarangayAccessCard";
import { supabase } from "@/lib/supabaseClient";
import { publicSans } from "@/app/fonts/publicSans";
import { normalizeBarangaySearch, searchBarangays } from "@/lib/barangaySearch";

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
  const [query, setQuery] = useState("");
  const [focusRequest, setFocusRequest] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const findButtonRef = useRef<HTMLButtonElement>(null);
  const normalizedQuery = normalizeBarangaySearch(query);
  const matches = useMemo(
    () => searchBarangays(barangays, query),
    [barangays, query],
  );
  const focusedBarangay = useMemo(() => {
    if (!normalizedQuery) return null;
    const match =
      matches.find(
        (barangay) =>
          normalizeBarangaySearch(barangay.name) === normalizedQuery,
      ) ?? (matches.length === 1 ? matches[0] : null);
    return match ? { ...match } : null;
  }, [matches, normalizedQuery, focusRequest]);

  function findBarangay(barangay: Barangay) {
    setQuery(barangay.name);
    setFocusRequest((request) => request + 1);
    searchRef.current?.blur();
    findButtonRef.current?.focus({ preventScroll: true });
  }

  function openAccess(barangay: Barangay) {
    setSelected(barangay);
    setCode("");
    setAccessError("");
  }

  function clearSearch() {
    setQuery("");
    searchRef.current?.focus({ preventScroll: true });
  }

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
            Find your barangay on the map, then use its access card to open your
            workspace.
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
            <form
              className="barangay-search"
              role="search"
              aria-label="Find a barangay"
              onSubmit={(event) => {
                event.preventDefault();
                if (normalizedQuery && matches[0] && !busy)
                  findBarangay(matches[0]);
              }}
            >
              <label htmlFor="barangay-search">Search barangay</label>
              <div className="barangay-search-row">
                <div className="barangay-search-input">
                  <Search size={18} aria-hidden="true" />
                  <input
                    ref={searchRef}
                    id="barangay-search"
                    name="barangay"
                    type="search"
                    placeholder="Search barangay name…"
                    autoComplete="off"
                    enterKeyHint="search"
                    spellCheck={false}
                    value={query}
                    disabled={busy}
                    aria-describedby="barangay-search-hint"
                    aria-controls="barangay-search-results"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label="Clear barangay search"
                      disabled={busy}
                      onClick={clearSearch}
                    >
                      <X size={17} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <button
                  ref={findButtonRef}
                  type="submit"
                  className="primary-button"
                  disabled={busy || !normalizedQuery || matches.length === 0}
                >
                  <MapPin size={16} aria-hidden="true" />
                  Find on map
                </button>
              </div>
              <p id="barangay-search-hint">
                Search by name to see the location and barangay access card.
              </p>
              {normalizedQuery && !focusedBarangay && matches.length > 1 && (
                <div
                  className="barangay-search-suggestions"
                  aria-label="Matching barangays"
                >
                  {matches.slice(0, 6).map((barangay) => (
                    <button
                      key={barangay.id}
                      type="button"
                      disabled={busy}
                      onClick={() => findBarangay(barangay)}
                    >
                      <MapPin size={14} aria-hidden="true" />
                      {barangay.name}
                    </button>
                  ))}
                </div>
              )}
              <p
                className="barangay-search-status"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {normalizedQuery
                  ? `${matches.length} ${matches.length === 1 ? "barangay" : "barangays"} found.`
                  : ""}
              </p>
            </form>
            <div
              id="barangay-search-results"
              className={`barangay-search-layout${focusedBarangay ? " has-focused-barangay" : ""}`}
            >
              <BarangayEvacuationOverview focusedBarangay={focusedBarangay} />
              {focusedBarangay && (
                <aside
                  className="barangay-search-access"
                  aria-label={`${focusedBarangay.name} access`}
                >
                  <h2>Barangay access</h2>
                  <BarangayAccessCard
                    barangay={focusedBarangay}
                    selected={selected?.id === focusedBarangay.id}
                    disabled={busy}
                    onSelect={() => openAccess(focusedBarangay)}
                  />
                  <p>Select the card to enter your barangay access code.</p>
                </aside>
              )}
            </div>
            {!focusedBarangay && (
              <>
                <h2 id="barangay-selection-title">
                  {normalizedQuery
                    ? "Matching barangays"
                    : "Select your barangay"}
                </h2>
                {normalizedQuery && matches.length === 0 ? (
                  <div className="barangay-search-empty">
                    <p>
                      No barangay matches “{query}”. Check the spelling or clear
                      your search.
                    </p>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={clearSearch}
                    >
                      Show all barangays
                    </button>
                  </div>
                ) : (
                  <div
                    className="barangay-access-grid"
                    aria-labelledby="barangay-selection-title"
                  >
                    {matches.map((barangay) => (
                      <BarangayAccessCard
                        key={barangay.id}
                        barangay={barangay}
                        disabled={busy}
                        selected={selected?.id === barangay.id}
                        onSelect={() => openAccess(barangay)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
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
