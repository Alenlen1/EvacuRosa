"use client";
import { AssistanceRequests } from "@/components/admin/AssistanceRequests";

import {
  CenterManager,
  type ManagedCenter,
} from "@/components/admin/CenterManager";
import { adminApi } from "@/lib/adminApi";
import dynamic from "next/dynamic";
import Image from "next/image";
import { StaffHeader } from "@/components/admin/StaffHeader";
import {
  CdrrmoSection,
  CdrrmoWorkspace,
} from "@/components/admin/CdrrmoWorkspace";
import {
  CdrrmoDashboard,
  type DashboardHazards,
} from "@/components/admin/CdrrmoDashboard";
import { MapPin, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { publicSans } from "@/app/fonts/publicSans";
import { barangayCardAppearance } from "@/lib/barangayCardAppearance";
import { BarangayWorkspaceCenter } from "@/components/admin/BarangayWorkspaceCenter";
import { BarangayWorkspaceSummary } from "@/components/admin/BarangayWorkspaceSummary";
import { useWorkspaceLoadingRole } from "@/hooks/useWorkspaceLoadingRole";
import {
  clearWorkspaceRole,
  readWorkspaceRole,
  rememberWorkspaceRole,
} from "@/lib/workspaceLoading";
import {
  DashboardSkeleton,
  MapSkeleton,
} from "@/components/admin/LoadingSkeleton";
import {
  fetchFloodReports,
  fetchFireIncidents,
  fetchEarthquakes,
  type FloodReport,
  type FireIncident,
  type EarthquakeRoadImpact,
} from "@/services/api";

const HazardPlacementMap = dynamic(
  () => import("@/components/admin/HazardPlacementMap"),
  {
    ssr: false,
    loading: () => <MapSkeleton label="Loading hazard map..." />,
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
  const [loadingRole, setLoadingRole] = useWorkspaceLoadingRole();
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
  const [earthquakeRoadImpacts, setEarthquakeRoadImpacts] = useState<
    EarthquakeRoadImpact[]
  >([]);
  const [dashboardHazards, setDashboardHazards] = useState<DashboardHazards>({
    floods: null,
    fires: null,
    earthquakes: null,
  });
  const [hazardsLoading, setHazardsLoading] = useState(true);
  const refreshHazards = useCallback(async () => {
    setHazardsLoading(true);
    const [floods, fires, earthquakes] = await Promise.allSettled([
      fetchFloodReports(),
      fetchFireIncidents(),
      fetchEarthquakes(),
    ]);
    if (floods.status === "fulfilled") setFloodReports(floods.value);
    if (fires.status === "fulfilled") setFireIncidents(fires.value);
    if (earthquakes.status === "fulfilled") {
      setEarthquakeRoadImpacts(earthquakes.value.roadImpacts);
    }
    setDashboardHazards({
      floods: floods.status === "fulfilled" ? floods.value.length : null,
      fires: fires.status === "fulfilled" ? fires.value.length : null,
      earthquakes:
        earthquakes.status === "fulfilled"
          ? earthquakes.value.roadImpacts.length
          : null,
    });
    setHazardsLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setError("Supabase isn't configured yet — see supabase/README.md.");
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        clearWorkspaceRole();
        router.push("/admin/login");
        return;
      }
      setLoadingRole(readWorkspaceRole(data.session.user.id));
      loadCenters()
        .then((loadedProfile) =>
          rememberWorkspaceRole(loadedProfile.role, data.session!.user.id),
        )
        .catch(() => {})
        .finally(() => setReady(true));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile?.role !== "SUPER_ADMIN") return;
    void refreshHazards();
  }, [profile?.role, refreshHazards]);

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
      return body.profile as Profile;
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

  if (!ready || (!profile && retrying))
    return <DashboardSkeleton role={profile?.role ?? loadingRole} />;

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
  const content = (
    <div
      className={
        profile?.role === "SUPER_ADMIN"
          ? "cdrrmo-content"
          : "barangay-workspace-content"
      }
    >
      {profile.role === "BARANGAY_ADMIN" && (
        <div className="admin-heading">
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
          <div>
            <span className="eyebrow">BARANGAY WORKSPACE</span>
            <h1>{barangayTitle}</h1>
            <p className="barangay-workspace-subtitle">
              Evacuation center management
            </p>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      {profile.role === "SUPER_ADMIN" && error && (
        <p className="cdrrmo-workspace-error error-message" role="alert">
          {error}
        </p>
      )}

      {profile.role === "SUPER_ADMIN" && (
        <CdrrmoSection id="dashboard-overview">
          <CdrrmoDashboard
            centers={centers}
            centersUnavailable={Boolean(error)}
            hazards={dashboardHazards}
            hazardsLoading={hazardsLoading}
            onRefreshHazards={() => void refreshHazards()}
          />
        </CdrrmoSection>
      )}

      {profile.role === "BARANGAY_ADMIN" && (
        <BarangayWorkspaceSummary
          centers={centers}
          unavailable={Boolean(error)}
        />
      )}

      {profile?.role === "SUPER_ADMIN" && (
        <CdrrmoSection id="evacuation-centers">
          <CenterManager
            centers={centers}
            onSaved={async () => {
              await loadCenters();
            }}
          />
        </CdrrmoSection>
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
                  occupancyDrafts[center.id] ?? String(center.current_occupancy)
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
        <CdrrmoSection id="shared-locations">
          <div
            id="shared-locations"
            className="cdrrmo-section-anchor"
            tabIndex={-1}
          >
            <AssistanceRequests />
          </div>
        </CdrrmoSection>
      )}
      {profile?.role === "SUPER_ADMIN" && (
        <CdrrmoSection id="hazard-management">
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
              earthquakeRoadImpacts={earthquakeRoadImpacts}
              getAuthToken={getAuthToken}
              onCreated={() => void refreshHazards()}
            />
          </section>
        </CdrrmoSection>
      )}
    </div>
  );
  const signOut = async () => {
    const result = await supabase?.auth.signOut();
    if (result?.error) throw result.error;
    clearWorkspaceRole();
    router.replace("/admin/login");
  };
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
      {profile.role === "SUPER_ADMIN" ? (
        <CdrrmoWorkspace onSignOut={signOut}>{content}</CdrrmoWorkspace>
      ) : (
        <>
          <StaffHeader role={profile.role} onSignOut={signOut} />
          {content}
        </>
      )}
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
  earthquakeRoadImpacts: EarthquakeRoadImpact[];
  getAuthToken: () => Promise<string | undefined>;
  onCreated: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    getAuthToken().then((t) => setToken(t ?? null));
  }, [getAuthToken]);

  if (!token) {
    return <MapSkeleton label="Preparing hazard tools..." />;
  }

  return <HazardPlacementMap {...rest} authToken={token} />;
}
