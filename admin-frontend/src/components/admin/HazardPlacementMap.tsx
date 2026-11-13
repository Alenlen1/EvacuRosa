"use client";

import "leaflet/dist/leaflet.css";
import { useDeleteConfirmation } from "./DeleteConfirmationDialog";
import { HazardArchive } from "./HazardArchive";
import { HazardRecordTime } from "./HazardRecordTime";
import { SantaRosaBoundaryLayer } from "./SantaRosaBoundaryLayer";
import { BarangayBoundaryLayer } from "./BarangayBoundaryLayer";
import { BARANGAY_LOCATIONS } from "@/lib/barangayLocations";
import { EarthquakeAreaHandles } from "./EarthquakeAreaHandles";
import { isImpactArea } from "../../../../backend/src/algorithms/earthquakeArea";
import { EarthquakeLayer } from "@/components/map/EarthquakeLayer";
import { useEffect, useRef, useState } from "react";
import { latLngBounds } from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  Archive,
  Trash2,
  PersonStanding,
  ExternalLink,
  RotateCcw,
  X,
} from "lucide-react";
import {
  hazardCoordinates,
  roadCoordinates,
  removeHazardBatch,
} from "@/lib/adminHazards";
import {
  FloodIcon,
  FireIcon,
  EarthquakeIcon,
} from "@/components/ui/HazardIcons";
import { createDivIcon } from "@/components/map/icons";
import {
  isInsideSantaRosa,
  santaRosaBounds,
  HAZARD_CITY_ERROR,
} from "../../../../backend/src/geography/santaRosa";

import { FloodLayer } from "@/components/map/FloodLayer";
import { FireLayer } from "@/components/map/FireLayer";
import {
  fetchNearestRoads,
  fetchFloodSection,
  fetchEarthquakeArea,
  type EarthquakeAreaRoad,
  type EarthquakeRectangleArea,
  type FloodSectionPreview,
  createFloodReport,
  createFireIncident,
  createEarthquakeRoadImpact,
  deleteFloodReport,
  deleteFireIncident,
  deleteEarthquakeRoadImpact,
  permanentlyDeleteHazard,
  type FloodReport,
  type FireIncident,
  type EarthquakeRoadImpact,
  type NearestRoad,
} from "@/services/api";

type Mode = "flood" | "fire" | "earthquake";

const barangayNames = BARANGAY_LOCATIONS.map(({ name }) => name).sort((a, b) =>
  a.localeCompare(b),
);

const pendingIcon = createDivIcon(
  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" fill="#185FA5" fill-opacity="0.25" stroke="#185FA5" stroke-width="2"/>
    <circle cx="12" cy="12" r="3" fill="#185FA5"/>
  </svg>`,
  22,
);

function KeepMapSized() {
  const map = useMap();
  const needsInitialFit = useRef(
    !map.getContainer().clientWidth || !map.getContainer().clientHeight,
  );
  useEffect(() => {
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const container = map.getContainer();
        // Retained workspaces can be hidden; preserve the selected view when
        // they become visible again rather than fitting the city on resize.
        if (!container.clientWidth || !container.clientHeight) return;
        map.invalidateSize({
          animate: false,
          pan: true,
          debounceMoveend: true,
        });
        if (needsInitialFit.current) {
          map.fitBounds(santaRosaBounds, { padding: [16, 16], animate: false });
          needsInitialFit.current = false;
        }
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(map.getContainer());
    resize();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [map]);
  return null;
}

function ClickCapture({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

interface HazardPlacementMapProps {
  floodReports: FloodReport[];
  fireIncidents: FireIncident[];
  earthquakeRoadImpacts: EarthquakeRoadImpact[];
  authToken: string;
  onCreated: () => void;
}

/**
 * This is what makes A* and the fuzzy engine actually react to something:
 * flood reports and earthquake impacts are road-anchored (need a roadId),
 * so flood clicks snap to the nearest real road via
 * GET /api/roads/nearest — nobody has to know or type a raw roadId. Fire
 * incidents are point+radius. Earthquake debris uses a draggable area and
 * explicit road confirmation, with geometry recomputed by the server.
 */
export default function HazardPlacementMap({
  floodReports,
  fireIncidents,
  earthquakeRoadImpacts,
  authToken,
  onCreated,
}: HazardPlacementMapProps) {
  const { confirmDelete, deleteDialog } = useDeleteConfirmation();
  const [workspaceView, setWorkspaceView] = useState<
    "report" | "records" | "archive"
  >("report");
  const [mode, setMode] = useState<Mode>("flood");
  const [boundaryBarangay, setBoundaryBarangay] = useState("");
  const [inspectStreet, setInspectStreet] = useState(false);
  const [streetViewPoint, setStreetViewPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [streetViewError, setStreetViewError] = useState<string | null>(null);
  const [floodCoverage, setFloodCoverage] = useState<"section" | "entire-road">(
    "section",
  );
  const [sectionEnd, setSectionEnd] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [sectionPreview, setSectionPreview] =
    useState<FloodSectionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [nearestRoads, setNearestRoads] = useState<NearestRoad[]>([]);
  const [selectedRoadId, setSelectedRoadId] = useState<string>("");
  const [severity, setSeverity] = useState("MODERATE");
  const [radiusMeters, setRadiusMeters] = useState(200);
  const [debrisArea, setDebrisArea] = useState<EarthquakeRectangleArea | null>(
    null,
  );
  const [drawingArea, setDrawingArea] = useState(true);
  const [areaEditing, setAreaEditing] = useState(false);
  const [areaPreview, setAreaPreview] = useState<{
    key: string;
    roads: EarthquakeAreaRoad[];
  } | null>(null);
  const [areaLoading, setAreaLoading] = useState(false);
  const [selectedAreaRoadIds, setSelectedAreaRoadIds] = useState<string[]>([]);
  const areaKey = debrisArea ? JSON.stringify(debrisArea) : "";
  const areaRoads =
    !areaEditing && areaPreview?.key === areaKey ? areaPreview.roads : [];
  const areaReady =
    mode === "earthquake" &&
    !drawingArea &&
    !areaEditing &&
    areaPreview?.key === areaKey &&
    !areaLoading;
  const [waterLevelMeters, setWaterLevelMeters] = useState<string>("");
  const impassable = severity === "HIGH" || severity === "SEVERE";
  const [confirmedBlocked, setConfirmedBlocked] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookingUpRoads, setLookingUpRoads] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removalAction, setRemovalAction] = useState<"archive" | "delete">(
    "archive",
  );
  const [removalNotice, setRemovalNotice] = useState<string | null>(null);
  const removalPending = useRef(false);
  const roadLookupVersion = useRef(0);
  const submitPending = useRef(false);

  useEffect(() => {
    if (mode !== "earthquake" || !debrisArea) return;
    setAreaPreview(null);
    setSelectedAreaRoadIds([]);
    if (areaEditing) {
      setAreaLoading(false);
      return;
    }
    if (!isImpactArea(debrisArea)) {
      setAreaLoading(false);
      setError("Draw a rectangle between 5 and 500 metres on each side.");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setAreaLoading(true);
    const timer = setTimeout(() => {
      void fetchEarthquakeArea(debrisArea, controller.signal)
        .then((roads) => {
          if (!cancelled) {
            setAreaPreview({ key: areaKey, roads });
            setError(null);
          }
        })
        .catch((reason) => {
          if (!cancelled)
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not preview affected roads.",
            );
        })
        .finally(() => {
          if (!cancelled) setAreaLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [mode, debrisArea, areaKey, areaEditing]);

  useEffect(() => {
    if (
      mode !== "flood" ||
      floodCoverage !== "section" ||
      !pendingPoint ||
      !sectionEnd ||
      !selectedRoadId
    ) {
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setPreviewLoading(true);
    setSectionPreview(null);
    void fetchFloodSection(
      selectedRoadId,
      { latitude: pendingPoint.lat, longitude: pendingPoint.lng },
      sectionEnd,
      controller.signal,
    )
      .then((preview) => {
        if (!cancelled) {
          setSectionPreview(preview);
          setError(null);
        }
      })
      .catch((error) => {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : "Could not preview this road section.",
          );
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mode, floodCoverage, pendingPoint, sectionEnd, selectedRoadId]);

  const previewSegments =
    mode === "flood"
      ? ((floodCoverage === "section"
          ? sectionPreview?.affectedSegments
          : nearestRoads.find((road) => road.roadId === selectedRoadId)
              ?.affectedSegments) ?? [])
      : mode === "earthquake"
        ? areaRoads
            .filter((road) => selectedAreaRoadIds.includes(road.roadId))
            .flatMap((road) => road.affectedSegments)
        : [];

  const snappedPreview =
    mode === "flood" && floodCoverage === "section" ? sectionPreview : null;
  const displayedStart =
    snappedPreview?.snappedStart ??
    (pendingPoint
      ? { latitude: pendingPoint.lat, longitude: pendingPoint.lng }
      : null);
  const displayedEnd = snappedPreview?.snappedEnd ?? sectionEnd;

  async function handleMapClick(lat: number, lng: number, reportStart = false) {
    if (loading || submitPending.current || removalPending.current) return;
    if (mode === "earthquake") {
      return;
    }
    if (inspectStreet && !reportStart) {
      if (!isInsideSantaRosa(lat, lng)) {
        setStreetViewError(
          "Select a street photo location inside Santa Rosa City.",
        );
        return;
      }
      setStreetViewPoint({ latitude: lat, longitude: lng });
      setStreetViewError(null);
      return;
    }
    if (!isInsideSantaRosa(lat, lng)) {
      resetForm();
      setError(HAZARD_CITY_ERROR);
      return;
    }
    if (
      mode === "flood" &&
      !reportStart &&
      floodCoverage === "section" &&
      pendingPoint &&
      selectedRoadId &&
      !lookingUpRoads
    ) {
      setError(null);
      setSectionPreview(null);
      setSectionEnd({ latitude: lat, longitude: lng });
      return;
    }
    const version = ++roadLookupVersion.current;
    if (reportStart) {
      setSectionEnd(null);
      setSectionPreview(null);
    }
    setError(null);
    setPendingPoint({ lat, lng });
    setSelectedRoadId("");
    setNearestRoads([]);

    if (mode === "fire") return; // point-based, no road lookup needed

    setLookingUpRoads(true);
    try {
      const roads = await fetchNearestRoads(lat, lng, 3, true);
      if (version !== roadLookupVersion.current) return;
      setNearestRoads(roads);
      if (roads.length > 0) setSelectedRoadId(roads[0].roadId);
    } catch {
      if (version === roadLookupVersion.current)
        setError("Could not look up nearby Santa Rosa roads.");
    } finally {
      if (version === roadLookupVersion.current) setLookingUpRoads(false);
    }
  }

  function resetPlacement() {
    roadLookupVersion.current++;
    setLookingUpRoads(false);
    setPendingPoint(null);
    setSectionEnd(null);
    setSectionPreview(null);
    setPreviewLoading(false);
    setNearestRoads([]);
    setSelectedRoadId("");
    setAreaPreview(null);
    setSelectedAreaRoadIds([]);
    setAreaLoading(false);
    setDebrisArea(null);
    setAreaEditing(false);
    setDrawingArea(true);
  }

  function changeDebrisArea(area: EarthquakeRectangleArea) {
    if (loading || submitPending.current || removalPending.current) return;
    if (!isImpactArea(area)) {
      setError(
        "Draw a rectangle between 5 and 500 metres on each side. Zoom in for a smaller area.",
      );
      return;
    }
    if (!isInsideSantaRosa(area.latitude, area.longitude)) {
      setError(HAZARD_CITY_ERROR);
      return;
    }
    setError(null);
    setAreaPreview(null);
    setSelectedAreaRoadIds([]);
    setDebrisArea(area);
    setPendingPoint({ lat: area.latitude, lng: area.longitude });
    setDrawingArea(false);
  }

  function resetForm() {
    resetPlacement();
    setWaterLevelMeters("");
    setConfirmedBlocked(false);
    setNotes("");
  }

  function restartFloodSelection() {
    resetPlacement();
    setError(null);
    setInspectStreet(false);
    setStreetViewPoint(null);
    setStreetViewError(null);
  }

  async function handleSubmit() {
    if (!pendingPoint || removalPending.current || submitPending.current)
      return;
    if (!isInsideSantaRosa(pendingPoint.lat, pendingPoint.lng)) {
      setError(HAZARD_CITY_ERROR);
      return;
    }
    submitPending.current = true;
    setLoading(true);
    setError(null);
    try {
      if (mode === "flood") {
        if (!selectedRoadId) throw new Error("Select a road first.");
        if (
          floodCoverage === "section" &&
          (!sectionPreview || !sectionEnd || previewLoading)
        )
          throw new Error(
            "Select an end point and review the flooded road section before saving.",
          );
        await createFloodReport(authToken, {
          roadId: selectedRoadId,
          coverage: floodCoverage,
          ...(floodCoverage === "section" && sectionEnd
            ? {
                sectionStart: {
                  latitude: pendingPoint.lat,
                  longitude: pendingPoint.lng,
                },
                sectionEnd,
              }
            : {}),
          severity: severity as FloodReport["severity"],
          waterLevelMeters: waterLevelMeters
            ? Number(waterLevelMeters)
            : undefined,
          roadImpassable: impassable,
          notes: notes || undefined,
        });
      } else if (mode === "fire") {
        await createFireIncident(authToken, {
          latitude: pendingPoint.lat,
          longitude: pendingPoint.lng,
          severity: severity as FireIncident["severity"],
          radiusMeters,
          notes: notes || undefined,
        });
      } else {
        if (
          !debrisArea ||
          !areaReady ||
          selectedAreaRoadIds.some(
            (id) => !areaRoads.some((road) => road.roadId === id),
          )
        )
          throw new Error(
            "Review the affected area before saving. Select only roads with verified damage.",
          );
        await createEarthquakeRoadImpact(authToken, {
          impactArea: debrisArea,
          selectedRoadIds: selectedAreaRoadIds,
          impactLevel: severity as "LOW" | "MODERATE" | "HIGH",
          confirmedBlocked: selectedAreaRoadIds.length > 0 && confirmedBlocked,
          notes: notes || undefined,
        });
      }
      resetForm();
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save this report.",
      );
    } finally {
      submitPending.current = false;
      setLoading(false);
    }
  }

  async function removeHazard(
    kind: "flood" | "fire" | "impact",
    id: string,
    permanent = false,
  ) {
    if (removalPending.current || loading) return;
    const label = kind === "impact" ? "earthquake report" : `${kind} record`;
    if (
      !(await confirmDelete({
        variant: permanent ? "delete" : "archive",
        title: permanent
          ? "Permanently delete this hazard?"
          : "Archive hazard record?",
        subject: label,
        description: permanent
          ? "This permanently deletes the active report and removes its restrictions from public routing. It will not be kept in the archive. This cannot be undone. Use Archive if you may need to restore it later."
          : "This moves the record to the archive and removes its restrictions from active routing. You can review and restore it from the Archive tab.",
        confirmLabel: permanent ? "Delete permanently" : "Archive record",
        cancelLabel: "Keep record",
      }))
    )
      return;
    removalPending.current = true;
    setRemovingId(id);
    setRemovalAction(permanent ? "delete" : "archive");
    setError(null);
    setRemovalNotice(null);
    try {
      if (permanent) await permanentlyDeleteHazard(authToken, kind, id);
      else if (kind === "flood") await deleteFloodReport(authToken, id);
      else if (kind === "fire") await deleteFireIncident(authToken, id);
      else await deleteEarthquakeRoadImpact(authToken, id);
      setRemovalNotice(
        permanent
          ? "Hazard permanently deleted."
          : "Hazard moved to the archive.",
      );
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not remove this record. Refresh before retrying.",
      );
    } finally {
      removalPending.current = false;
      setRemovingId(null);
    }
  }

  async function removeAllHazards() {
    if (removalPending.current || loading) return;
    const count =
      floodReports.length + fireIncidents.length + earthquakeRoadImpacts.length;
    if (
      !count ||
      !(await confirmDelete({
        variant: "archive",
        title: "Archive all hazard records?",
        subject: `${count} loaded records`,
        description:
          "This archives loaded flood reports, fire incidents and earthquake reports. Their road restrictions are removed from active routing. You can restore them from the Archive tab.",
        confirmLabel: "Archive all records",
      }))
    )
      return;
    removalPending.current = true;
    setRemovingId("all");
    setRemovalAction("archive");
    setError(null);
    setRemovalNotice(null);
    try {
      const result = await removeHazardBatch([
        ...floodReports.map(
          (item) => () => deleteFloodReport(authToken, item.id),
        ),
        ...fireIncidents.map(
          (item) => () => deleteFireIncident(authToken, item.id),
        ),
        ...earthquakeRoadImpacts.map(
          (item) => () => deleteEarthquakeRoadImpact(authToken, item.id),
        ),
      ]);
      const { failed, removed } = result;
      setRemovalNotice(`Archived ${removed} hazard record(s).`);
      if (failed)
        setError(
          `${failed} record(s) could not be archived or were skipped. Refresh and retry the remaining records.`,
        );
      resetForm();
      onCreated();
    } finally {
      removalPending.current = false;
      setRemovingId(null);
    }
  }

  function hazardActions(kind: "flood" | "fire" | "impact", id: string) {
    const pending = removingId === id;
    return (
      <div className="hazard-record-actions">
        <button
          type="button"
          onClick={() => void removeHazard(kind, id)}
          disabled={removingId !== null || loading}
        >
          <Archive size={14} aria-hidden="true" />
          {pending && removalAction === "archive" ? "Archiving..." : "Archive"}
        </button>
        <button
          type="button"
          onClick={() => void removeHazard(kind, id, true)}
          disabled={removingId !== null || loading}
        >
          <Trash2 size={14} aria-hidden="true" />
          {pending && removalAction === "delete" ? "Deleting..." : "Delete"}
        </button>
      </div>
    );
  }

  return (
    <div className="hazard-workspace">
      <div className="hazard-view-tabs" aria-label="Hazard workspace view">
        <button
          type="button"
          aria-pressed={workspaceView === "report"}
          onClick={() => setWorkspaceView("report")}
        >
          Report a hazard
        </button>
        <button
          type="button"
          aria-pressed={workspaceView === "records"}
          onClick={() => setWorkspaceView("records")}
        >
          Manage records (
          {floodReports.length +
            fireIncidents.length +
            earthquakeRoadImpacts.length}
          )
        </button>
        <button
          type="button"
          aria-pressed={workspaceView === "archive"}
          onClick={() => setWorkspaceView("archive")}
        >
          Archive
        </button>
      </div>
      {workspaceView === "archive" && (
        <HazardArchive authToken={authToken} onRestored={onCreated} />
      )}
      <div
        className="hazard-editor"
        data-view={workspaceView}
        style={workspaceView === "archive" ? { display: "none" } : undefined}
      >
        <div className="hazard-tabs" aria-label="Hazard type">
          {[
            { key: "flood" as const, label: "Flood", icon: FloodIcon },
            { key: "fire" as const, label: "Fire", icon: FireIcon },
            {
              key: "earthquake" as const,
              label: "Earthquake",
              icon: EarthquakeIcon,
            },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => {
                setMode(key);
                setInspectStreet(false);
                setStreetViewPoint(null);
                setStreetViewError(null);
                resetForm();
                // severity is shared state across all three modes, but
                // earthquake's valid values (LOW/MODERATE/HIGH) don't
                // include SEVERE — reset to a value valid in every mode so
                // switching away from flood/fire with SEVERE selected can't
                // carry an invalid value into an earthquake submission.
                setSeverity("MODERATE");
              }}
              className={`flex flex-1 items-center justify-center gap-1 py-2 text-xs font-medium ${
                mode === key
                  ? "border-b-2 border-blue-600 text-blue-700"
                  : "text-slate-500"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="hazard-location-toolbar">
          <div
            className="hazard-boundary-selector"
            data-has-boundary={Boolean(boundaryBarangay)}
          >
            <div className="hazard-boundary-field">
              <label htmlFor="hazard-barangay-boundary">
                Barangay boundary <span>Optional</span>
              </label>
              <select
                id="hazard-barangay-boundary"
                value={boundaryBarangay}
                onChange={(event) => setBoundaryBarangay(event.target.value)}
                disabled={loading || removingId !== null}
                aria-describedby="hazard-boundary-help"
              >
                <option value="">All Santa Rosa barangays</option>
                {barangayNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <p id="hazard-boundary-help" role="status">
              {boundaryBarangay
                ? "Boundary guide only. You can report hazards across barangay boundaries."
                : "Choose a barangay to focus the map, or report anywhere in Santa Rosa."}
            </p>
            {boundaryBarangay && (
              <button
                type="button"
                className="secondary-button hazard-citywide-button"
                aria-label="Show all Santa Rosa barangays"
                title="Citywide view"
                onClick={() => setBoundaryBarangay("")}
                disabled={loading || removingId !== null}
              >
                <RotateCcw size={16} aria-hidden="true" />
                <span>Citywide view</span>
              </button>
            )}
          </div>
          {mode === "flood" && (
            <div className="hazard-event-selector">
              <label htmlFor="flood-coverage" className="mb-1 block text-xs">
                Flood coverage
              </label>
              <select
                id="flood-coverage"
                value={floodCoverage}
                disabled={loading || removingId !== null}
                onChange={(event) => {
                  setFloodCoverage(
                    event.target.value as "section" | "entire-road",
                  );
                  resetForm();
                  setError(null);
                }}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="section">
                  Affected road section (start and end)
                </option>
                <option value="entire-road">Entire mapped road</option>
              </select>
              <p className="mt-1 text-xs">
                {floodCoverage === "section"
                  ? "Select the start, review the street, then select the end on the same connected street. The preview follows the street between those points."
                  : "Select a point near the road. Every mapped segment of that road will be affected."}
              </p>
            </div>
          )}

          {mode === "earthquake" && (
            <p className="earthquake-area-instructions">
              Click and drag across the map to draw a rectangle around observed
              debris. Drag its centre to move, a corner to resize, or the round
              arrow handle to rotate. Then confirm only roads with verified
              damage.
            </p>
          )}
        </div>

        <div
          className={`hazard-editor-map${inspectStreet ? " is-inspecting-street" : ""}`}
        >
          <MapContainer
            bounds={santaRosaBounds}
            boundsOptions={{ padding: [16, 16], animate: false }}
            maxBounds={latLngBounds(santaRosaBounds).pad(0.1)}
            maxBoundsViscosity={0.8}
            minZoom={10}
            zoomSnap={0.25}
            zoomDelta={0.5}
            className="h-full w-full"
          >
            <KeepMapSized />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <SantaRosaBoundaryLayer />
            <BarangayBoundaryLayer
              name={boundaryBarangay || null}
              resetToCity
              shadeOutside={false}
              zoomOffset={0}
            />
            <FloodLayer reports={floodReports} />
            <FireLayer incidents={fireIncidents} />
            <EarthquakeLayer events={[]} roadImpacts={earthquakeRoadImpacts} />
            {mode === "earthquake" &&
              areaRoads
                .filter((road) => !selectedAreaRoadIds.includes(road.roadId))
                .flatMap((road) => road.affectedSegments)
                .map((segment, index) => (
                  <Polyline
                    key={`candidate-${index}`}
                    positions={segment.map((point) => [
                      point.latitude,
                      point.longitude,
                    ])}
                    interactive={false}
                    pathOptions={{
                      color: "#64748b",
                      weight: 6,
                      opacity: 0.6,
                      dashArray: "5 5",
                    }}
                  />
                ))}
            {mode === "earthquake" && (
              <EarthquakeAreaHandles
                area={debrisArea}
                drawing={drawingArea}
                disabled={loading || removingId !== null}
                onChange={changeDebrisArea}
                onCancel={() => setDrawingArea(false)}
                onEditingChange={setAreaEditing}
              />
            )}
            {mode === "flood" && inspectStreet && streetViewPoint && (
              <CircleMarker
                center={[streetViewPoint.latitude, streetViewPoint.longitude]}
                radius={9}
                pathOptions={{
                  color: "#946b00",
                  fillColor: "#f4d84b",
                  fillOpacity: 1,
                  weight: 3,
                }}
                interactive={false}
              >
                <Tooltip permanent>Street photo location</Tooltip>
              </CircleMarker>
            )}
            {previewSegments.map((segment, index) => (
              <Polyline
                key={`preview-${index}`}
                positions={segment.map((point) => [
                  point.latitude,
                  point.longitude,
                ])}
                pathOptions={{
                  color: "#7c3aed",
                  weight: 9,
                  opacity: 0.85,
                }}
                interactive={false}
              />
            ))}
            {mode === "flood" &&
              floodCoverage === "section" &&
              displayedEnd && (
                <CircleMarker
                  center={[displayedEnd.latitude, displayedEnd.longitude]}
                  radius={8}
                  pathOptions={{ color: "#7c3aed", fillOpacity: 1 }}
                  interactive={false}
                >
                  <Tooltip permanent>End</Tooltip>
                </CircleMarker>
              )}
            {snappedPreview && (
              <CircleMarker
                center={[
                  snappedPreview.snappedStart.latitude,
                  snappedPreview.snappedStart.longitude,
                ]}
                radius={8}
                pathOptions={{ color: "#185FA5", fillOpacity: 1 }}
                interactive={false}
              >
                <Tooltip permanent>Start</Tooltip>
              </CircleMarker>
            )}
            {pendingPoint && !snappedPreview && mode !== "earthquake" && (
              <Marker
                position={[pendingPoint.lat, pendingPoint.lng]}
                icon={pendingIcon}
              >
                <Tooltip>
                  {mode === "flood" && floodCoverage === "section"
                    ? "Start"
                    : "Selected location"}
                </Tooltip>
              </Marker>
            )}
            {mode !== "earthquake" && <ClickCapture onClick={handleMapClick} />}
          </MapContainer>
          {mode === "earthquake" && (
            <button
              type="button"
              className="earthquake-draw-toggle secondary-button"
              aria-pressed={drawingArea}
              disabled={loading || removingId !== null}
              onClick={() => {
                setDrawingArea((value) => !value);
                setError(null);
              }}
            >
              <RotateCcw size={16} aria-hidden="true" />
              {drawingArea
                ? "Cancel drawing"
                : debrisArea
                  ? "Redraw area"
                  : "Draw area"}
            </button>
          )}
          {mode === "flood" && (
            <>
              <button
                type="button"
                className="hazard-street-view-toggle"
                aria-label="Inspect street photos"
                title="Select a point to view Google Street View"
                aria-pressed={inspectStreet}
                disabled={loading || removingId !== null}
                onClick={() => {
                  setInspectStreet((value) => !value);
                  setStreetViewError(null);
                  if (!inspectStreet && !streetViewPoint && displayedStart)
                    setStreetViewPoint(displayedStart);
                }}
              >
                <PersonStanding size={22} aria-hidden="true" />
                <span>Street View</span>
              </button>
              {inspectStreet && (
                <section
                  className="hazard-street-view-panel"
                  aria-label="Street photo inspection"
                >
                  <div className="hazard-street-view-heading">
                    <strong>Find the road with street photos</strong>
                    <button
                      type="button"
                      aria-label="Close street photo inspection"
                      onClick={() => setInspectStreet(false)}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <p>
                    Select a point on the map to check nearby landmarks. Your
                    flood selection stays in place.
                  </p>
                  {streetViewError && <p role="alert">{streetViewError}</p>}
                  {streetViewPoint && (
                    <>
                      <p className="hazard-street-view-coordinates">
                        {hazardCoordinates(streetViewPoint)}
                      </p>
                      <a
                        href={`https://www.google.com/maps/@?${new URLSearchParams({ api: "1", map_action: "pano", viewpoint: `${streetViewPoint.latitude},${streetViewPoint.longitude}` })}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={15} aria-hidden="true" /> Open
                        Google Street View
                      </a>
                      <small>
                        Opens Google Maps in a new tab or app. Photos depend on
                        coverage and may be old; verify current flooding
                        separately.
                      </small>
                      <button
                        type="button"
                        className="hazard-street-view-use"
                        disabled={loading || removingId !== null}
                        onClick={() => {
                          setInspectStreet(false);
                          void handleMapClick(
                            streetViewPoint.latitude,
                            streetViewPoint.longitude,
                            true,
                          );
                        }}
                      >
                        Use as new flood start
                      </button>
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        <div className="hazard-form">
          <p className="mb-2 text-xs text-slate-600">
            Santa Rosa City only. Select a location inside the outlined city
            boundary.
          </p>
          <h3 className="mb-3 text-sm font-semibold">
            Report{" "}
            {mode === "earthquake" ? "an earthquake/debris area" : `a ${mode}`}
          </h3>
          <p className="hazard-timestamp-note">
            Date and time are recorded automatically when you save.
          </p>
          <p className="mb-2 text-xs text-slate-500">
            {mode === "fire"
              ? "Tap the map where the fire is."
              : mode === "earthquake"
                ? drawingArea
                  ? "Drag from one corner of the debris area to the opposite corner. Press Escape to cancel drawing."
                  : "Drag the centre to move, a corner to resize, or the round arrow to rotate. You can also use the Rotation slider. Confirm the affected road sections below."
                : mode === "flood" && floodCoverage === "section"
                  ? pendingPoint
                    ? "Select the end of the affected section on the same connected street. Use Reset selection to choose a different start."
                    : "Tap the start of the affected road section."
                  : "Tap the map near the affected road."}
          </p>
          {mode === "flood" && pendingPoint && (
            <div className="mb-3 text-xs">
              <p>
                {hazardCoordinates(displayedStart ?? undefined)}
                {floodCoverage === "section" ? " (start)" : ""}
              </p>
              {displayedEnd && <p>{hazardCoordinates(displayedEnd)} (end)</p>}
              {previewLoading && (
                <p role="status">Previewing affected road section…</p>
              )}
              {sectionPreview && floodCoverage === "section" && (
                <p role="status">
                  Preview: {sectionPreview.distanceMeters} m across{" "}
                  {sectionPreview.edgeIds.length} mapped segment(s). Only the
                  purple section receives this flood report. Start and End snap
                  to the road near your clicks, keeping the selected length.
                </p>
              )}
              {floodCoverage === "entire-road" &&
                previewSegments.length > 0 && (
                  <p role="status">
                    The purple preview covers the entire mapped road.
                  </p>
                )}
              <div className="flood-reset-selection">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={loading || removingId !== null}
                  onClick={restartFloodSelection}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  Reset selection
                </button>
                <small>Choose a new location. Report details are kept.</small>
              </div>
            </div>
          )}

          {error && (
            <p className="mb-2 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          {!pendingPoint && (
            <div className="hazard-form-empty">
              <span className="eyebrow">START ON THE MAP</span>
              <strong>Select the affected location</strong>
              <p>
                {mode === "fire"
                  ? "Choose the incident location, then enter the radius and severity."
                  : mode === "earthquake"
                    ? "Choose Draw area, then click and drag to cover the observed debris. Use a small rectangle to avoid unrelated roads."
                    : "Choose a point near the affected road, then review the suggested road and report details."}
              </p>
              <small>
                Only report observed or verified conditions. A confirmed
                blockage changes route availability.
              </small>
            </div>
          )}

          {pendingPoint && (
            <div className="hazard-report-fields space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
              {mode === "earthquake" && (
                <fieldset
                  className="earthquake-area-fields"
                  disabled={
                    loading || removingId !== null || areaEditing || drawingArea
                  }
                >
                  <legend>Verified debris area</legend>
                  <p className="earthquake-area-size" role="status">
                    Rectangle: {Math.round(debrisArea?.widthMeters ?? 0)} m wide
                    × {Math.round(debrisArea?.heightMeters ?? 0)} m long
                    {" · "}
                    {Math.round(debrisArea?.rotationDegrees ?? 0)}° rotation
                  </p>
                  <div className="earthquake-rotation-control">
                    <label htmlFor="earthquake-rotation">Rotation</label>
                    <input
                      id="earthquake-rotation"
                      type="range"
                      min={0}
                      max={359}
                      step={1}
                      value={debrisArea?.rotationDegrees ?? 0}
                      aria-valuetext={`${Math.round(debrisArea?.rotationDegrees ?? 0)} degrees clockwise`}
                      onChange={(event) => {
                        if (debrisArea)
                          changeDebrisArea({
                            ...debrisArea,
                            rotationDegrees: Number(event.target.value),
                          });
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      resetPlacement();
                      setError(null);
                    }}
                  >
                    <RotateCcw size={16} aria-hidden="true" /> Reset selection
                  </button>
                  <p>
                    This marks observed debris, not the earthquake's reach.
                    Leave roads unselected to save the area without changing
                    routing.
                  </p>
                  <strong>Affected roads (optional)</strong>
                  {areaEditing ? (
                    <p role="status">
                      Release the handle to preview affected roads.
                    </p>
                  ) : areaLoading ? (
                    <p role="status">Previewing road sections…</p>
                  ) : !areaReady ? (
                    <p>
                      Move, resize or rotate the rectangle to retry the preview.
                    </p>
                  ) : areaRoads.length === 0 ? (
                    <p role="status">
                      No mapped city road intersects this rectangle. You can
                      save it as an area-only report.
                    </p>
                  ) : (
                    <>
                      <p>
                        Grey = candidate section. Purple = selected section.
                        Select only roads with verified damage.
                      </p>
                      <div className="earthquake-area-roads">
                        {areaRoads.map((road) => (
                          <label key={road.roadId}>
                            <input
                              type="checkbox"
                              checked={selectedAreaRoadIds.includes(
                                road.roadId,
                              )}
                              onChange={(event) =>
                                setSelectedAreaRoadIds((ids) =>
                                  event.target.checked
                                    ? [...ids, road.roadId]
                                    : ids.filter((id) => id !== road.roadId),
                                )
                              }
                            />
                            <span>
                              {road.roadName ?? "Unnamed mapped road"}
                              <small>{road.distanceMeters} m inside area</small>
                            </span>
                          </label>
                        ))}
                      </div>
                      <p role="status">
                        {selectedAreaRoadIds.length} road(s) selected ·{" "}
                        {areaRoads
                          .filter((road) =>
                            selectedAreaRoadIds.includes(road.roadId),
                          )
                          .reduce(
                            (total, road) => total + road.distanceMeters,
                            0,
                          )}{" "}
                        m affected
                      </p>
                    </>
                  )}
                </fieldset>
              )}

              {mode === "flood" && (
                <div>
                  <label
                    htmlFor="hazard-road"
                    className="mb-1 block text-xs text-slate-600"
                  >
                    Nearest road
                  </label>
                  {lookingUpRoads ? (
                    <p className="text-xs text-slate-400">
                      Looking up nearby roads…
                    </p>
                  ) : nearestRoads.length === 0 ? (
                    <p className="text-xs text-red-600">
                      No road found near this point.
                    </p>
                  ) : (
                    <select
                      id="hazard-road"
                      value={selectedRoadId}
                      onChange={(e) => {
                        setSelectedRoadId(e.target.value);
                        setSectionEnd(null);
                        setSectionPreview(null);
                        setError(null);
                      }}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      {nearestRoads.map((r) => (
                        <option key={r.roadId} value={r.roadId}>
                          {r.roadName ?? "Unnamed mapped road"} (
                          {r.distanceMeters}m away)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {mode !== "earthquake" && (
                <div>
                  <label
                    htmlFor="hazard-severity"
                    className="mb-1 block text-xs text-slate-600"
                  >
                    Severity
                  </label>
                  <select
                    id="hazard-severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    {mode === "flood"
                      ? ["LOW", "MODERATE", "HIGH", "SEVERE"].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))
                      : ["LOW", "MODERATE", "HIGH", "SEVERE"].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                  </select>
                </div>
              )}

              {mode === "earthquake" && (
                <div>
                  <label
                    htmlFor="impact-level"
                    className="mb-1 block text-xs text-slate-600"
                  >
                    Verified impact level
                  </label>
                  <select
                    id="impact-level"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    {["LOW", "MODERATE", "HIGH"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {mode === "flood" && (
                <div>
                  <label
                    htmlFor="water-level"
                    className="mb-1 block text-xs text-slate-600"
                  >
                    Water level in meters (optional — leave blank if unmeasured)
                  </label>
                  <input
                    id="water-level"
                    type="number"
                    step="0.1"
                    value={waterLevelMeters}
                    onChange={(e) => setWaterLevelMeters(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </div>
              )}

              {mode === "fire" && (
                <div>
                  <label
                    htmlFor="fire-radius"
                    className="mb-1 block text-xs text-slate-600"
                  >
                    Radius (meters)
                  </label>
                  <input
                    id="fire-radius"
                    type="number"
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(Number(e.target.value))}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </div>
              )}

              {mode === "flood" && (
                <div className="text-xs text-slate-700" role="status">
                  <strong>
                    {impassable
                      ? "Impassable — blocked for routing"
                      : "Passable for routing — flood risk still applies"}
                  </strong>
                  <p className="mt-1">
                    Low/Moderate: passable. High/Severe: impassable. Passable
                    does not guarantee safety.
                  </p>
                </div>
              )}

              {mode === "earthquake" && (
                <div>
                  <label
                    htmlFor="earthquake-passability"
                    className="mb-1 block text-xs text-slate-600"
                  >
                    Road passability
                  </label>
                  <select
                    id="earthquake-passability"
                    value={
                      selectedAreaRoadIds.length === 0
                        ? "area-only"
                        : confirmedBlocked
                          ? "blocked"
                          : "passable"
                    }
                    onChange={(event) =>
                      setConfirmedBlocked(event.target.value === "blocked")
                    }
                    aria-describedby="earthquake-passability-help"
                    disabled={
                      loading ||
                      removingId !== null ||
                      selectedAreaRoadIds.length === 0
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    {selectedAreaRoadIds.length === 0 && (
                      <option value="area-only">
                        Area only — no routing change
                      </option>
                    )}
                    <option value="passable">Passable — impact only</option>
                    <option value="blocked">Confirmed blocked</option>
                  </select>
                  <p
                    id="earthquake-passability-help"
                    className="mt-1 text-xs text-slate-600"
                    role="status"
                  >
                    {selectedAreaRoadIds.length === 0
                      ? "The drawn area will appear on the map. No roads will be blocked or assigned earthquake risk."
                      : confirmedBlocked
                        ? "Selected road sections will be excluded from routes."
                        : "Blockage is optional. Selected roads remain passable; earthquake risk still applies."}
                  </p>
                  {selectedAreaRoadIds.length > 0 && (
                    <p className="mt-1 text-xs text-slate-600">
                      Passable does not guarantee safety.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label
                  htmlFor="hazard-notes"
                  className="mb-1 block text-xs text-slate-600"
                >
                  Notes (optional)
                </label>
                <input
                  id="hazard-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    loading ||
                    removingId !== null ||
                    lookingUpRoads ||
                    previewLoading ||
                    (mode === "earthquake" && !areaReady) ||
                    (mode === "flood" &&
                      floodCoverage === "section" &&
                      !sectionPreview) ||
                    (mode === "flood" && !selectedRoadId)
                  }
                  className="flex-1 rounded bg-blue-600 py-1.5 text-xs font-medium text-white disabled:bg-slate-300"
                >
                  {loading ? "Saving\u2026" : "Save report"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="secondary-button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="hazard-records">
          <h3 className="text-sm font-semibold text-slate-700">
            Active hazard records
          </h3>
          <button
            type="button"
            onClick={() => void removeAllHazards()}
            disabled={
              loading ||
              removingId !== null ||
              !(
                floodReports.length +
                fireIncidents.length +
                earthquakeRoadImpacts.length
              )
            }
            className="inline-flex items-center gap-1 rounded border border-red-300 px-3 py-2 text-xs text-red-700 disabled:opacity-50"
          >
            <Archive size={14} aria-hidden="true" />
            {removingId === "all" ? "Archiving all…" : "Archive all hazards"}
          </button>
          {removalNotice && (
            <p role="status" className="text-xs">
              {removalNotice}
            </p>
          )}
          {workspaceView === "records" && error && (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          )}
          {floodReports.length === 0 &&
            fireIncidents.length === 0 &&
            earthquakeRoadImpacts.length === 0 && (
              <p className="text-xs text-slate-500">
                No active hazard records.
              </p>
            )}
          {floodReports.length > 0 && (
            <section className="space-y-1">
              <h4 className="text-xs font-medium text-amber-800">Floods</h4>
              {floodReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between gap-3 rounded border border-slate-200 px-2 py-1.5 text-xs"
                >
                  <span>
                    {report.severity} ·{" "}
                    {report.affectedEdgeIds == null
                      ? "Entire mapped road"
                      : "Selected section"}{" "}
                    · Road location: {roadCoordinates(report.affectedSegments)}
                    {report.roadImpassable ? " · blocked" : ""}
                    <HazardRecordTime
                      value={report.reportedAt}
                      label="Reported"
                    />
                  </span>
                  {hazardActions("flood", report.id)}
                </div>
              ))}
            </section>
          )}
          {fireIncidents.length > 0 && (
            <section className="space-y-1">
              <h4 className="text-xs font-medium text-red-800">Fires</h4>
              {fireIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-center justify-between gap-3 rounded border border-slate-200 px-2 py-1.5 text-xs"
                >
                  <span>
                    {incident.severity} fire · {incident.radiusMeters}m radius
                    {" · "}
                    {hazardCoordinates(incident)}
                    <HazardRecordTime
                      value={incident.reportedAt}
                      label="Reported"
                    />
                  </span>
                  {hazardActions("fire", incident.id)}
                </div>
              ))}
            </section>
          )}
          {earthquakeRoadImpacts.length > 0 && (
            <section className="space-y-1">
              <h4 className="text-xs font-medium text-amber-900">
                Earthquake reports
              </h4>
              {earthquakeRoadImpacts.map((impact) => (
                <div
                  key={impact.id}
                  className="flex items-center justify-between gap-3 rounded border border-slate-200 px-2 py-1.5 text-xs"
                >
                  <span>
                    {impact.impactLevel} impact ·{" "}
                    {impact.roadId == null
                      ? "Area only · No road routing change"
                      : impact.impactArea
                        ? impact.impactArea.shape === "rectangle"
                          ? `Debris rectangle (${Math.round(impact.impactArea.widthMeters)} × ${Math.round(impact.impactArea.heightMeters)} m, ${Math.round(impact.impactArea.rotationDegrees ?? 0)}°) · Selected section`
                          : `Debris area (${impact.impactArea.radiusMeters} m radius) · Selected section`
                        : "Entire mapped road"}{" "}
                    {impact.roadId == null && impact.impactArea
                      ? ` · Area center: ${impact.impactArea.latitude.toFixed(6)}, ${impact.impactArea.longitude.toFixed(6)}`
                      : ` · Road location: ${roadCoordinates(impact.affectedSegments)}`}
                    {impact.roadId == null
                      ? ""
                      : impact.confirmedBlocked
                        ? " · blocked"
                        : " · not marked blocked"}
                    {impact.notes && (
                      <span className="block">{impact.notes}</span>
                    )}
                    <HazardRecordTime
                      value={impact.verifiedAt}
                      label="Verified"
                    />
                  </span>
                  {hazardActions("impact", impact.id)}
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
      {deleteDialog}
    </div>
  );
}
