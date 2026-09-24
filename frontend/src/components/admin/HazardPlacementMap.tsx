"use client";

import "leaflet/dist/leaflet.css";
import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { Droplet, Flame, Activity, Trash2 } from "lucide-react";
import {
  SANTA_ROSA_CITY_BOUNDS,
  SANTA_ROSA_CITY_CENTER,
  SANTA_ROSA_CITY_DEFAULT_ZOOM,
} from "@/lib/mapBounds";
import { createDivIcon } from "@/components/map/icons";
import { FloodLayer } from "@/components/map/FloodLayer";
import { FireLayer } from "@/components/map/FireLayer";
import { EarthquakeLayer } from "@/components/map/EarthquakeLayer";
import {
  fetchNearestRoads,
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
  22
);

function ClickCapture({ onClick }: { onClick: (lat: number, lng: number) => void }) {
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
  const [mode, setMode] = useState<Mode>("flood");
  const [pendingPoint, setPendingPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [nearestRoads, setNearestRoads] = useState<NearestRoad[]>([]);
  const [selectedRoadId, setSelectedRoadId] = useState<string>("");
  const [selectedEarthquakeId, setSelectedEarthquakeId] = useState<string>("");
  const [severity, setSeverity] = useState("MODERATE");
  const [radiusMeters, setRadiusMeters] = useState(200);
  const [waterLevelMeters, setWaterLevelMeters] = useState<string>("");
  const [impassable, setImpassable] = useState(false);
  const [confirmedBlocked, setConfirmedBlocked] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookingUpRoads, setLookingUpRoads] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleMapClick(lat: number, lng: number) {
    setError(null);
    setPendingPoint({ lat, lng });
    setSelectedRoadId("");

    if (mode === "fire") return; // point-based, no road lookup needed

    setLookingUpRoads(true);
    try {
      const roads = await fetchNearestRoads(lat, lng, 3);
      setNearestRoads(roads);
      if (roads.length > 0) setSelectedRoadId(roads[0].roadId);
    } catch {
      setError("Could not look up nearby roads.");
    } finally {
      setLookingUpRoads(false);
    }
  }

  function resetForm() {
    setPendingPoint(null);
    setNearestRoads([]);
    setSelectedRoadId("");
    setWaterLevelMeters("");
    setImpassable(false);
    setConfirmedBlocked(false);
    setNotes("");
  }

  async function handleSubmit() {
    if (!pendingPoint) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "flood") {
        if (!selectedRoadId) throw new Error("Select a road first.");
        await createFloodReport(authToken, {
          roadId: selectedRoadId,
          severity: severity as FloodReport["severity"],
          waterLevelMeters: waterLevelMeters ? Number(waterLevelMeters) : undefined,
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
        if (!selectedEarthquakeId) throw new Error("Select an earthquake event first.");
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
      setError(err instanceof Error ? err.message : "Could not save this report.");
    } finally {
      setLoading(false);
    }
  }

  async function removeHazard(kind: "flood" | "fire" | "earthquake" | "impact", id: string) {
    const label = kind === "impact" ? "earthquake road impact" : `${kind} record`;
    if (!window.confirm(`Remove this ${label}?`)) return;
    setRemovingId(id);
    setError(null);
    try {
      if (kind === "flood") await deleteFloodReport(authToken, id);
      else if (kind === "fire") await deleteFireIncident(authToken, id);
      else if (kind === "impact") await deleteEarthquakeRoadImpact(authToken, id);
      else await deleteEarthquakeEvent(authToken, id);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this record.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex border-b border-slate-200">
        {(
          [
            { key: "flood" as const, label: "Flood", icon: Droplet },
            { key: "fire" as const, label: "Fire", icon: Flame },
            { key: "earthquake" as const, label: "Earthquake", icon: Activity },
          ]
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key);
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

      {mode === "earthquake" && (
        <div className="border-b border-slate-200 p-2">
          <label className="mb-1 block text-xs text-slate-600">
            Earthquake event to verify impact for
          </label>
          <select
            value={selectedEarthquakeId}
            onChange={(e) => setSelectedEarthquakeId(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="">Select an event…</option>
            {earthquakeEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                M{ev.magnitude.toFixed(1)} — {new Date(ev.occurredAt).toLocaleDateString()} (
                {ev.status})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="relative h-[65vh] min-h-[480px] max-h-[760px] w-full">
        <MapContainer
          center={SANTA_ROSA_CITY_CENTER}
          zoom={SANTA_ROSA_CITY_DEFAULT_ZOOM}
          maxBounds={SANTA_ROSA_CITY_BOUNDS}
          maxBoundsViscosity={0.8}
          minZoom={12}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FloodLayer reports={floodReports} />
          <FireLayer incidents={fireIncidents} />
          <EarthquakeLayer events={earthquakeEvents} roadImpacts={earthquakeRoadImpacts} />
          {pendingPoint && (
            <Marker position={[pendingPoint.lat, pendingPoint.lng]} icon={pendingIcon} />
          )}
          <ClickCapture onClick={handleMapClick} />
        </MapContainer>
      </div>

      <div className="p-3">
        <p className="mb-2 text-xs text-slate-500">
          {mode === "fire"
            ? "Tap the map where the fire is."
            : "Tap the map near the affected road."}
        </p>

        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

        {pendingPoint && (
          <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
            {mode !== "fire" && (
              <div>
                <label className="mb-1 block text-xs text-slate-600">Nearest road</label>
                {lookingUpRoads ? (
                  <p className="text-xs text-slate-400">Looking up nearby roads…</p>
                ) : nearestRoads.length === 0 ? (
                  <p className="text-xs text-red-600">No road found near this point.</p>
                ) : (
                  <select
                    value={selectedRoadId}
                    onChange={(e) => setSelectedRoadId(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    {nearestRoads.map((r) => (
                      <option key={r.roadId} value={r.roadId}>
                        {r.roadName ?? r.roadId} ({r.distanceMeters}m away)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {mode !== "earthquake" && (
              <div>
                <label className="mb-1 block text-xs text-slate-600">Severity</label>
                <select
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
                <label className="mb-1 block text-xs text-slate-600">
                  Verified impact level
                </label>
                <select
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
                <label className="mb-1 block text-xs text-slate-600">
                  Water level in meters (optional — leave blank if unmeasured)
                </label>
                <input
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
                <label className="mb-1 block text-xs text-slate-600">Radius (meters)</label>
                <input
                  type="number"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </div>
            )}

            {mode === "flood" && (
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={impassable}
                  onChange={(e) => setImpassable(e.target.checked)}
                />
                Confirmed impassable — hard-blocks this road for routing
              </label>
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
              <label className="mb-1 block text-xs text-slate-600">Notes (optional)</label>
              <input
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
                disabled={loading}
                className="flex-1 rounded bg-blue-600 py-1.5 text-xs font-medium text-white disabled:bg-slate-300"
              >
                {loading ? "Saving…" : "Save report"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-200 p-3">
        <h3 className="text-sm font-semibold text-slate-700">Active hazard records</h3>
        {floodReports.length === 0 && fireIncidents.length === 0 && earthquakeEvents.length === 0 && (
          <p className="text-xs text-slate-500">No active hazard records.</p>
        )}
        {floodReports.length > 0 && (
          <section className="space-y-1">
            <h4 className="text-xs font-medium text-amber-800">Floods</h4>
            {floodReports.map((report) => (
              <div key={report.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 px-2 py-1.5 text-xs">
                <span>{report.severity} · {report.roadId}{report.roadImpassable ? " · blocked" : ""}</span>
                <button type="button" onClick={() => removeHazard("flood", report.id)} disabled={removingId === report.id} className="inline-flex items-center gap-1 text-red-700 disabled:opacity-50">
                  <Trash2 size={13} /> {removingId === report.id ? "Removing…" : "Remove"}
                </button>
              </div>
            ))}
          </section>
        )}
        {fireIncidents.length > 0 && (
          <section className="space-y-1">
            <h4 className="text-xs font-medium text-red-800">Fires</h4>
            {fireIncidents.map((incident) => (
              <div key={incident.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 px-2 py-1.5 text-xs">
                <span>{incident.severity} fire · {incident.radiusMeters}m radius</span>
                <button type="button" onClick={() => removeHazard("fire", incident.id)} disabled={removingId === incident.id} className="inline-flex items-center gap-1 text-red-700 disabled:opacity-50">
                  <Trash2 size={13} /> {removingId === incident.id ? "Removing…" : "Remove"}
                </button>
              </div>
            ))}
          </section>
        )}
        {earthquakeEvents.length > 0 && (
          <section className="space-y-1">
            <h4 className="text-xs font-medium text-amber-900">Earthquakes and verified impacts</h4>
            {earthquakeEvents.map((event) => {
              const impacts = earthquakeRoadImpacts.filter((impact) => impact.earthquakeEventId === event.id);
              return (
                <div key={event.id} className="rounded border border-slate-200 px-2 py-1.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span>M{event.magnitude.toFixed(1)} · {new Date(event.occurredAt).toLocaleDateString()} · {event.status}</span>
                    <button type="button" onClick={() => removeHazard("earthquake", event.id)} disabled={removingId === event.id} className="inline-flex items-center gap-1 text-red-700 disabled:opacity-50">
                      <Trash2 size={13} /> {removingId === event.id ? "Removing…" : "Remove event"}
                    </button>
                  </div>
                  {impacts.map((impact) => (
                    <div key={impact.id} className="mt-1 flex items-center justify-between gap-3 border-t border-slate-100 pt-1">
                      <span>{impact.impactLevel} impact · {impact.roadId}{impact.confirmedBlocked ? " · blocked" : ""}</span>
                      <button type="button" onClick={() => removeHazard("impact", impact.id)} disabled={removingId === impact.id} className="text-red-700 disabled:opacity-50">
                        {removingId === impact.id ? "Removing…" : "Remove impact"}
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
  );
}
