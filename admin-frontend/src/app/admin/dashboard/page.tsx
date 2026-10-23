"use client";
import { AssistanceRequests } from "@/components/admin/AssistanceRequests";

import {
  CenterManager,
  type ManagedCenter,
} from "@/components/admin/CenterManager";
import { adminApi } from "@/lib/adminApi";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Brand } from "@/components/ui/Brand";
import { House, MapPin, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { publicSans } from "@/app/fonts/publicSans";
import { barangayCardAppearance } from "@/lib/barangayCardAppearance";
import { BarangayWorkspaceCenter } from "@/components/admin/BarangayWorkspaceCenter";
import { BarangayWorkspaceSummary } from "@/components/admin/BarangayWorkspaceSummary";
import {
  fetchFloodReports,
  fetchFireIncidents,
  fetchEarthquakes,
  type FloodReport,
  type FireIncident,
  type EarthquakeEvent,
  type EarthquakeRoadImpact,
} from "@/services/api";

const HazardPlacementMap = dynamic(
  () => import("@/components/admin/HazardPlacementMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
        Loading map…
      </div>
    ),
  },
);

type AdminCenter = ManagedCenter & { updated_at?: string | null };
type CenterFeedback = { kind: "success" | "error"; message: string };

interface Profile {
  role: "BARANGAY_ADMIN" | "SUPER_ADMIN";
  barangay_id: string | null;
  barangay_name?: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [centers, setCenters] = useState<AdminCenter[]>([]);
  const [availabilityDrafts, setAvailabilityDrafts] = useState<
    Record<string, string>
  >({});
  const [occupancyDrafts, setOccupancyDrafts] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [centerFeedback, setCenterFeedback] = useState<
    Record<string, CenterFeedback | undefined>
  >({});
  const [ready, setReady] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const [floodReports, setFloodReports] = useState<FloodReport[]>([]);
  const [fireIncidents, setFireIncidents] = useState<FireIncident[]>([]);
  const [earthquakeEvents, setEarthquakeEvents] = useState<EarthquakeEvent[]>(
    [],
  );
  const [earthquakeRoadImpacts, setEarthquakeRoadImpacts] = useState<
    EarthquakeRoadImpact[]
  >([]);

  useEffect(() => {
    if (!supabase) {
      setError("Supabase isn't configured yet — see supabase/README.md.");
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/admin/login");
        return;
      }
      loadCenters()
        .catch(() => {})
        .finally(() => setReady(true));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile?.role !== "SUPER_ADMIN") return;
    fetchFloodReports()
      .then(setFloodReports)
      .catch(() => setFloodReports([]));
    fetchFireIncidents()
      .then(setFireIncidents)
      .catch(() => setFireIncidents([]));
    fetchEarthquakes()
      .then(({ events, roadImpacts }) => {
        setEarthquakeEvents(events);
        setEarthquakeRoadImpacts(roadImpacts);
      })
      .catch(() => {
        setEarthquakeEvents([]);
        setEarthquakeRoadImpacts([]);
      });
  }, [profile?.role]);

  async function loadCenters() {
    setError(null);
    try {
      const body = await adminApi("/evacuation-centers");
      setProfile(body.profile);
      const rows: AdminCenter[] = body.centers;
      setCenters(rows);
      setAvailabilityDrafts(
        Object.fromEntries(
          rows.map((center) => [
            center.id,
            center.status === "CLOSED" ? "CLOSED" : "AVAILABLE",
          ]),
        ),
      );
      setOccupancyDrafts(
        Object.fromEntries(
          rows.map((center) => [center.id, String(center.current_occupancy)]),
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not load assigned centers.",
      );
      throw error;
    }
  }

  async function updateOccupancy(id: string) {
    if (!supabase || savingId !== null) return;
    const center = centers.find((item) => item.id === id);
    const draft = occupancyDrafts[id] ?? "";
    const currentOccupancy = Number(draft);
    if (
      !center ||
      draft.trim() === "" ||
      !Number.isSafeInteger(currentOccupancy) ||
      currentOccupancy < 0 ||
      !Number.isSafeInteger(center.capacity) ||
      center.capacity < 0 ||
      currentOccupancy > center.capacity
    ) {
      setCenterFeedback((feedback) => ({
        ...feedback,
        [id]: {
          kind: "error",
          message: `Enter a whole number from 0 to ${center?.capacity ?? "the center's capacity"}.`,
        },
      }));
      return;
    }
    setSavingId(id);
    clearCenterFeedback(id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token)
        throw new Error("Your session has expired. Please sign in again.");
      const res = await fetch(`${API_URL}/api/admin/evacuation-centers/${id}`, {
        method: "PUT",
        signal: AbortSignal.timeout(25000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentOccupancy,
          status:
            availabilityDrafts[id] ??
            (center.status === "CLOSED" ? "CLOSED" : "AVAILABLE"),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          body.error ?? "Could not save changes. Please try again.",
        );
      if (!body.center || body.center.id !== id)
        throw new Error(
          "Could not confirm the updated center details. Refresh the page before trying again.",
        );
      const savedCenter: AdminCenter = { ...center, ...body.center };
      setCenters((rows) =>
        rows.map((row) => (row.id === id ? savedCenter : row)),
      );
      setOccupancyDrafts((drafts) => ({
        ...drafts,
        [id]: String(savedCenter.current_occupancy),
      }));
      setAvailabilityDrafts((drafts) => ({
        ...drafts,
        [id]: savedCenter.status === "CLOSED" ? "CLOSED" : "AVAILABLE",
      }));
      setCenterFeedback((feedback) => ({
        ...feedback,
        [id]: { kind: "success", message: "Changes saved." },
      }));
    } catch (cause) {
      setCenterFeedback((feedback) => ({
        ...feedback,
        [id]: {
          kind: "error",
          message:
            cause instanceof TypeError
              ? "Could not save changes. Check your connection and try again."
              : cause instanceof Error && cause.name === "TimeoutError"
                ? "Saving took too long. Please try again."
                : cause instanceof Error
                  ? cause.message
                  : "Could not save changes. Please try again.",
        },
      }));
    } finally {
      setSavingId(null);
    }
  }

  function clearCenterFeedback(id: string) {
    setCenterFeedback((feedback) => ({ ...feedback, [id]: undefined }));
  }

  async function getAuthToken(): Promise<string | undefined> {
    if (!supabase) return undefined;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  const barangayName =
    profile?.barangay_name?.trim() ||
    centers
      .find((center) => center.barangay_id === profile?.barangay_id)
      ?.barangays?.name?.trim();
  const barangayTitle = barangayName
    ? /^barangay\s/i.test(barangayName)
      ? barangayName
      : `Barangay ${barangayName}`
    : "Barangay workspace";
  const barangayAppearance = barangayCardAppearance(
    (barangayName ?? "").replace(/^barangay\s+/i, ""),
  );

  if (!ready) {
    return (
      <main className="flex h-dvh items-center justify-center text-sm text-slate-500">
        Loading…
      </main>
    );
  }

  if (!profile)
    return (
      <main className="staff-login-content">
        <h1>Workspace unavailable</h1>
        <p role="alert">
          {error || "An authorized admin profile is required."}
        </p>
        <button
          className="primary-button"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true);
            try {
              await loadCenters();
            } catch {
              // loadCenters displays the error; keep the retry action available.
            } finally {
              setRetrying(false);
            }
          }}
        >
          {retrying ? "Retrying..." : "Retry"}
        </button>
        <button onClick={() => router.replace("/admin/login")}>
          Return to sign in
        </button>
      </main>
    );
  return (
    <main
      className={`admin-app ${publicSans.className} ${profile.role === "SUPER_ADMIN" ? "cdrrmo-workspace" : "barangay-workspace"}`}
      style={
        profile.role === "BARANGAY_ADMIN"
          ? ({
              "--workspace-color": barangayAppearance.background,
              "--workspace-accent": barangayAppearance.accent,
            } as CSSProperties)
          : undefined
      }
    >
      <header className="app-header">
        <Link href="/admin/dashboard" aria-label="EvacuRosa administration">
          <Brand />
        </Link>
        <span className="city-label">Santa Rosa, Laguna</span>
        {profile.role === "BARANGAY_ADMIN" && (
          <Link className="secondary-button" href="/admin/barangays">
            Barangay home
          </Link>
        )}
        {process.env.NEXT_PUBLIC_PUBLIC_APP_URL && (
          <a
            href={process.env.NEXT_PUBLIC_PUBLIC_APP_URL}
            className="admin-link"
          >
            Public map
          </a>
        )}
        <button
          className="secondary-button"
          onClick={async () => {
            await supabase?.auth.signOut();
            router.replace("/admin/login");
          }}
        >
          Sign out
        </button>
      </header>
      <div
        className={
          profile?.role === "SUPER_ADMIN"
            ? "cdrrmo-content"
            : "barangay-workspace-content"
        }
      >
        <div className="admin-heading">
          {profile.role === "BARANGAY_ADMIN" && (
            <span className="barangay-workspace-seal" aria-hidden="true">
              {barangayAppearance.logoSrc ? (
                <Image
                  src={barangayAppearance.logoSrc}
                  alt=""
                  fill
                  sizes="80px"
                />
              ) : (
                barangayAppearance.initials || "BRGY"
              )}
            </span>
          )}
          <div>
            <span className="eyebrow">
              {profile?.role === "SUPER_ADMIN"
                ? "CDRRMO WORKSPACE"
                : "BARANGAY WORKSPACE"}
            </span>
            <h1>
              {profile?.role === "SUPER_ADMIN"
                ? "City response workspace"
                : barangayTitle}
            </h1>
            <p
              className={
                profile.role === "BARANGAY_ADMIN"
                  ? "barangay-workspace-subtitle"
                  : undefined
              }
            >
              {profile?.role === "SUPER_ADMIN"
                ? "Register evacuation centers, review shared locations and manage hazards across Santa Rosa."
                : "Evacuation center management"}
            </p>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
          </div>
          {profile?.role === "SUPER_ADMIN" && (
            <span className="cdrrmo-access">
              <ShieldCheck size={17} aria-hidden="true" />
              CDRRMO staff access
            </span>
          )}
        </div>

        {profile.role === "BARANGAY_ADMIN" && (
          <BarangayWorkspaceSummary
            centers={centers}
            unavailable={Boolean(error)}
          />
        )}

        {profile?.role === "SUPER_ADMIN" && (
          <>
            <nav
              className="staff-section-nav"
              aria-label="CDRRMO workspace sections"
            >
              <a href="#evacuation-centers">
                <House size={19} aria-hidden="true" />
                <span>Evacuation centers</span>
              </a>
              <a href="#shared-locations">
                <MapPin size={19} aria-hidden="true" />
                <span>Shared locations</span>
              </a>
              <a href="#hazard-management">
                <TriangleAlert size={19} aria-hidden="true" />
                <span>Hazard management</span>
              </a>
            </nav>
            <CenterManager centers={centers} onSaved={loadCenters} />
          </>
        )}
        <div
          className={
            profile?.role !== "SUPER_ADMIN"
              ? "barangay-center-management"
              : undefined
          }
        >
          {profile?.role !== "SUPER_ADMIN" && (
            <div
              className="admin-center-cards"
              data-single={centers.length === 1}
            >
              {centers.map((center) => (
                <BarangayWorkspaceCenter
                  key={center.id}
                  center={center}
                  occupancyDraft={
                    occupancyDrafts[center.id] ??
                    String(center.current_occupancy)
                  }
                  availabilityDraft={
                    availabilityDrafts[center.id] ??
                    (center.status === "CLOSED" ? "CLOSED" : "AVAILABLE")
                  }
                  saving={savingId === center.id}
                  updatesDisabled={savingId !== null}
                  feedback={centerFeedback[center.id]}
                  onOccupancyChange={(value) => {
                    clearCenterFeedback(center.id);
                    setOccupancyDrafts((drafts) => ({
                      ...drafts,
                      [center.id]: value,
                    }));
                  }}
                  onAvailabilityChange={(value) => {
                    clearCenterFeedback(center.id);
                    setAvailabilityDrafts((drafts) => ({
                      ...drafts,
                      [center.id]: value,
                    }));
                  }}
                  onSave={() => void updateOccupancy(center.id)}
                />
              ))}
              {centers.length === 0 && !error && (
                <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                  <p className="font-medium text-slate-700">
                    No evacuation centers are assigned to your account.
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Contact your designated system operator about access. CDRRMO
                    registers and assigns evacuation centers.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {profile?.role === "SUPER_ADMIN" && (
          <div
            id="shared-locations"
            className="cdrrmo-section-anchor"
            tabIndex={-1}
          >
            <AssistanceRequests />
          </div>
        )}
        {profile?.role === "SUPER_ADMIN" && (
          <section
            id="hazard-management"
            className="admin-hazard-section cdrrmo-section-anchor"
            tabIndex={-1}
            aria-labelledby="hazard-management-title"
          >
            <div className="cdrrmo-section-heading">
              <div className="cdrrmo-heading-identity">
                <span className="cdrrmo-section-symbol" aria-hidden="true">
                  <TriangleAlert size={22} />
                </span>
                <div>
                  <span className="eyebrow">CITYWIDE REPORTING</span>
                  <h2 id="hazard-management-title">Hazard management</h2>
                  <p>Flood, fire and verified earthquake road impacts.</p>
                </div>
              </div>
              <span className="cdrrmo-map-label">
                <MapPin size={15} aria-hidden="true" />
                Santa Rosa, Laguna
              </span>
            </div>
            <ol
              className="cdrrmo-report-steps"
              aria-label="How to report a hazard"
            >
              <li>
                <span>1</span>Choose a hazard type
              </li>
              <li>
                <span>2</span>Select a point on the map
              </li>
              <li>
                <span>3</span>Review details and save
              </li>
            </ol>
            <HazardPlacementMapWrapper
              floodReports={floodReports}
              fireIncidents={fireIncidents}
              earthquakeEvents={earthquakeEvents}
              earthquakeRoadImpacts={earthquakeRoadImpacts}
              getAuthToken={getAuthToken}
              onCreated={() => {
                fetchFloodReports()
                  .then(setFloodReports)
                  .catch(() => {});
                fetchFireIncidents()
                  .then(setFireIncidents)
                  .catch(() => {});
                fetchEarthquakes()
                  .then(({ events, roadImpacts }) => {
                    setEarthquakeEvents(events);
                    setEarthquakeRoadImpacts(roadImpacts);
                  })
                  .catch(() => {});
              }}
            />
          </section>
        )}
      </div>
    </main>
  );
}

/** HazardPlacementMap needs a real token string, not a getter — this small
 * wrapper resolves the token once before the map (which needs it
 * synchronously available for its submit handler) ever mounts. */
function HazardPlacementMapWrapper({
  getAuthToken,
  ...rest
}: {
  floodReports: FloodReport[];
  fireIncidents: FireIncident[];
  earthquakeEvents: EarthquakeEvent[];
  earthquakeRoadImpacts: EarthquakeRoadImpact[];
  getAuthToken: () => Promise<string | undefined>;
  onCreated: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    getAuthToken().then((t) => setToken(t ?? null));
  }, [getAuthToken]);

  if (!token) {
    return <p className="text-xs text-slate-400">Preparing hazard tools…</p>;
  }

  return <HazardPlacementMap {...rest} authToken={token} />;
}
