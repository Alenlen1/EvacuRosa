"use client";

import "leaflet/dist/leaflet.css";
import { useDeleteConfirmation } from "./DeleteConfirmationDialog";
import { HazardRecordTime } from "./HazardRecordTime";
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Trash2, PersonStanding, ExternalLink, X } from "lucide-react";
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
  santaRosaBoundary,
  HAZARD_CITY_ERROR,
} from "../../../../backend/src/geography/santaRosa";

const cityOutline = santaRosaBoundary.geometry.coordinates.map((polygon) =>
  polygon.map((ring) =>
    ring.map(
      ([longitude, latitude]) => [latitude, longitude] as [number, number],
    ),
  ),
);
import { FloodLayer } from "@/components/map/FloodLayer";
import { FireLayer } from "@/components/map/FireLayer";
import { EarthquakeLayer } from "@/components/map/EarthquakeLayer";
import {
  fetchNearestRoads,
  fetchFloodSection,
  type FloodSectionPreview,
  createFloodReport,
  createFireIncident,
  createEarthquakeRoadImpact,
  deleteFloodReport,
  deleteFireIncident,
  deleteEarthquakeRoadImpact,
  deleteEarthquakeEvent,
  type FloodReport,
  type FireIncident,
  type EarthquakeEvent,
  type EarthquakeRoadImpact,
  type NearestRoad,
} from "@/services/api";

type Mode = "flood" | "fire" | "earthquake";

const pendingIcon = createDivIcon(
  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" fill="#185FA5" fill-opacity="0.25" stroke="#185FA5" stroke-width="2"/>
    <circle cx="12" cy="12" r="3" fill="#185FA5"/>
  </svg>`,
  22,
);

function KeepMapSized() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false, pan: true });
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
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
  earthquakeEvents: EarthquakeEvent[];
  earthquakeRoadImpacts: EarthquakeRoadImpact[];
  authToken: string;
  onCreated: () => void;
}

/**
 * This is what makes A* and the fuzzy engine actually react to something:
 * flood reports and earthquake impacts are road-anchored (need a roadId),
 * so a click here first snaps to the nearest real road via
 * GET /api/roads/nearest — nobody has to know or type a raw roadId. Fire
 * incidents are point+radius, so they skip that step entirely.
 */
export default function HazardPlacementMap({
  floodReports,
  fireIncidents,
  earthquakeEvents,
  earthquakeRoadImpacts,
  authToken,
  onCreated,
}: HazardPlacementMapProps) {
  const { confirmDelete, deleteDialog } = useDeleteConfirmation();
  const [workspaceView, setWorkspaceView] = useState<"report" | "records">(
    "report",
  );
  const [mode, setMode] = useState<Mode>("flood");
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
  const [selectedEarthquakeId, setSelectedEarthquakeId] = useState<string>("");
  const [severity, setSeverity] = useState("MODERATE");
  const [radiusMeters, setRadiusMeters] = useState(200);
  const [waterLevelMeters, setWaterLevelMeters] = useState<string>("");
  const impassable = severity === "HIGH" || severity === "SEVERE";
  const [confirmedBlocked, setConfirmedBlocked] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookingUpRoads, setLookingUpRoads] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removalNotice, setRemovalNotice] = useState<string | null>(null);
  const removalPending = useRef(false);
  const roadLookupVersion = useRef(0);

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
    if (loading || removalPending.current) return;
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

  function resetForm() {
    roadLookupVersion.current++;
    setLookingUpRoads(false);
    setPendingPoint(null);
    setSectionEnd(null);
    setSectionPreview(null);
    setPreviewLoading(false);
    setNearestRoads([]);
    setSelectedRoadId("");
    setWaterLevelMeters("");
    setConfirmedBlocked(false);
    setNotes("");
  }

  async function handleSubmit() {
    if (!pendingPoint || removalPending.current) return;
    if (!isInsideSantaRosa(pendingPoint.lat, pendingPoint.lng)) {
      setError(HAZARD_CITY_ERROR);
      return;
    }
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
        if (!selectedRoadId) throw new Error("Select a road first.");
        if (!selectedEarthquakeId)
          throw new Error("Select an earthquake event first.");
        await createEarthquakeRoadImpact(authToken, {
          earthquakeEventId: selectedEarthquakeId,
          roadId: selectedRoadId,
          impactLevel: severity as "LOW" | "MODERATE" | "HIGH",
          confirmedBlocked,
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
      setLoading(false);
    }
  }

  async function removeHazard(
    kind: "flood" | "fire" | "earthquake" | "impact",
    id: string,
  ) {
    if (removalPending.current || loading) return;
    const label =
      kind === "impact" ? "earthquake road impact" : `${kind} record`;
    if (
      !(await confirmDelete({
        title: "Remove hazard record?",
        subject: label,
        description:
          "This removes the record from the hazard map and changes the information used for routing. This action cannot be undone.",
        confirmLabel: "Remove record",
      }))
    )
      return;
    removalPending.current = true;
    setRemovingId(id);
    setError(null);
    setRemovalNotice(null);
    try {
      if (kind === "flood") await deleteFloodReport(authToken, id);
      else if (kind === "fire") await deleteFireIncident(authToken, id);
      else if (kind === "impact")
        await deleteEarthquakeRoadImpact(authToken, id);
      else await deleteEarthquakeEvent(authToken, id);
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove this record.",
      );
    } finally {
      removalPending.current = false;
      setRemovingId(null);
    }
  }

  async function removeAllHazards() {
    if (removalPending.current || loading) return;
    const count =
      floodReports.length +
      fireIncidents.length +
      earthquakeEvents.length +
      earthquakeRoadImpacts.length;
    if (
      !count ||
      !(await confirmDelete({
        title: "Remove all hazard records?",
        subject: `${count} loaded records`,
        description:
          "This removes loaded floods, fires, earthquake events and verified road impacts. Routing changes immediately. This action cannot be undone.",
        confirmLabel: "Remove all records",
      }))
    )
      return;
    removalPending.current = true;
    setRemovingId("all");
    setError(null);
    setRemovalNotice(null);
    try {
      // Remove impacts first, then their events. Never remove an event if any
      // impact deletion failed, so a failed impact remains available to retry.
      const first = await removeHazardBatch([
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
      const events =
        first.failed === 0
          ? await removeHazardBatch(
              earthquakeEvents.map(
                (item) => () => deleteEarthquakeEvent(authToken, item.id),
              ),
            )
          : { removed: 0, failed: earthquakeEvents.length };
      const failed = first.failed + events.failed;
      const removed = first.removed + events.removed;
      setRemovalNotice(`Removed ${removed} hazard record(s).`);
      if (failed)
        setError(
          `${failed} record(s) could not be removed or were skipped. Refresh and retry the remaining records.`,
        );
      resetForm();
      onCreated();
    } finally {
      removalPending.current = false;
      setRemovingId(null);
    }
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
            earthquakeEvents.length +
            earthquakeRoadImpacts.length}
          )
        </button>
      </div>
      <div className="hazard-editor" data-view={workspaceView}>
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
          <div className="hazard-event-selector">
            <label
              htmlFor="earthquake-event"
              className="mb-1 block text-xs text-slate-600"
            >
              Earthquake event to verify impact for
            </label>
            <select
              id="earthquake-event"
              value={selectedEarthquakeId}
              onChange={(e) => setSelectedEarthquakeId(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="">Select an event…</option>
              {earthquakeEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  M{ev.magnitude.toFixed(1)} —{" "}
                  {new Date(ev.occurredAt).toLocaleDateString()} ({ev.status})
                </option>
              ))}
            </select>
          </div>
        )}

        <div
          className={`hazard-editor-map${inspectStreet ? " is-inspecting-street" : ""}`}
        >
          <MapContainer
            bounds={santaRosaBounds}
            boundsOptions={{ padding: [16, 16] }}
            maxBounds={santaRosaBounds}
            maxBoundsViscosity={0.8}
            minZoom={10}
            className="h-full w-full"
          >
            <KeepMapSized />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polygon
              positions={cityOutline}
              attribution='Boundary: PSA/NAMRIA via <a href="https://github.com/faeldon/philippines-json-maps">Philippines JSON Maps</a>'
              pathOptions={{
                color: "#800000",
                weight: 2,
                fillOpacity: 0.04,
                interactive: false,
              }}
            />
            <FloodLayer reports={floodReports} />
            <FireLayer incidents={fireIncidents} />
            <EarthquakeLayer
              events={earthquakeEvents}
              roadImpacts={earthquakeRoadImpacts}
            />
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
                pathOptions={{ color: "#7c3aed", weight: 9, opacity: 0.85 }}
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
            {pendingPoint && !snappedPreview && (
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
            <ClickCapture onClick={handleMapClick} />
          </MapContainer>
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
            {mode === "earthquake" ? "a verified road impact" : `a ${mode}`}
          </h3>
          <p className="hazard-timestamp-note">
            Date and time are recorded automatically when you save.
          </p>
          <p className="mb-2 text-xs text-slate-500">
            {mode === "fire"
              ? "Tap the map where the fire is."
              : mode === "flood" && floodCoverage === "section"
                ? pendingPoint
                  ? "Select the end of the affected section on the same connected street. Use Start over to change the start."
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
              <button
                type="button"
                className="mt-2 underline"
                disabled={loading || removingId !== null}
                onClick={resetForm}
              >
                Start over
              </button>
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
              {mode !== "fire" && (
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
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={confirmedBlocked}
                    onChange={(e) => setConfirmedBlocked(e.target.checked)}
                  />
                  Confirmed blocked — hard-blocks this road for routing
                </label>
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
                    (mode === "flood" &&
                      floodCoverage === "section" &&
                      !sectionPreview) ||
                    (mode !== "fire" && !selectedRoadId)
                  }
                  className="flex-1 rounded bg-blue-600 py-1.5 text-xs font-medium text-white disabled:bg-slate-300"
                >
                  {loading ? "Saving…" : "Save report"}
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
                earthquakeEvents.length +
                earthquakeRoadImpacts.length
              )
            }
            className="inline-flex items-center gap-1 rounded border border-red-300 px-3 py-2 text-xs text-red-700 disabled:opacity-50"
          >
            <Trash2 size={14} aria-hidden="true" />
            {removingId === "all" ? "Removing all…" : "Remove all hazards"}
          </button>
          {removalNotice && (
            <p role="status" className="text-xs">
              {removalNotice}
            </p>
          )}
          {floodReports.length === 0 &&
            fireIncidents.length === 0 &&
            earthquakeEvents.length === 0 &&
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
                  <button
                    type="button"
                    onClick={() => removeHazard("flood", report.id)}
                    disabled={removingId !== null || loading}
                    className="inline-flex items-center gap-1 text-red-700 disabled:opacity-50"
                  >
                    <Trash2 size={13} />{" "}
                    {removingId === report.id ? "Removing…" : "Remove"}
                  </button>
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
                  <button
                    type="button"
                    onClick={() => removeHazard("fire", incident.id)}
                    disabled={removingId !== null || loading}
                    className="inline-flex items-center gap-1 text-red-700 disabled:opacity-50"
                  >
                    <Trash2 size={13} />{" "}
                    {removingId === incident.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              ))}
            </section>
          )}
          {earthquakeEvents.length > 0 && (
            <section className="space-y-1">
              <h4 className="text-xs font-medium text-amber-900">
                Earthquakes and verified impacts
              </h4>
              {earthquakeEvents.map((event) => {
                const impacts = earthquakeRoadImpacts.filter(
                  (impact) => impact.earthquakeEventId === event.id,
                );
                return (
                  <div
                    key={event.id}
                    className="rounded border border-slate-200 px-2 py-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        M{event.magnitude.toFixed(1)} · {event.status}
                        {" · "}
                        {hazardCoordinates(event)}
                        <HazardRecordTime
                          value={event.occurredAt}
                          label="Occurred"
                        />
                        <HazardRecordTime
                          value={event.createdAt}
                          label="Added"
                        />
                      </span>
                      <button
                        type="button"
                        onClick={() => removeHazard("earthquake", event.id)}
                        disabled={removingId !== null || loading}
                        className="inline-flex items-center gap-1 text-red-700 disabled:opacity-50"
                      >
                        <Trash2 size={13} />{" "}
                        {removingId === event.id ? "Removing…" : "Remove event"}
                      </button>
                    </div>
                    {impacts.map((impact) => (
                      <div
                        key={impact.id}
                        className="mt-1 flex items-center justify-between gap-3 border-t border-slate-100 pt-1"
                      >
                        <span>
                          {impact.impactLevel} impact · Road location:{" "}
                          {roadCoordinates(impact.affectedSegments)}
                          {impact.confirmedBlocked ? " · blocked" : ""}
                          <HazardRecordTime
                            value={impact.verifiedAt}
                            label="Verified"
                          />
                        </span>
                        <button
                          type="button"
                          onClick={() => removeHazard("impact", impact.id)}
                          disabled={removingId !== null || loading}
                          className="text-red-700 disabled:opacity-50"
                        >
                          {removingId === impact.id
                            ? "Removing…"
                            : "Remove impact"}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </div>
      {deleteDialog}
    </div>
  );
}
