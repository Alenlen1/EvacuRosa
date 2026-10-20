"use client";
import { useEffect, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { adminApi } from "@/lib/adminApi";
import { ShelterSuppliesForm } from "./ShelterSuppliesForm";
const LocationPicker = dynamic(() => import("./CenterLocationPicker"), {
  ssr: false,
});
export interface ManagedCenter {
  id: string;
  barangay_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity: number;
  current_occupancy: number;
  status: string;
  contact_information?: string;
  notes?: string;
  barangays?: { name: string } | null;
}
const empty = {
  barangayId: "",
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  capacity: "",
  contactInformation: "",
  notes: "",
};
export function CenterManager({
  centers,
  onSaved,
}: {
  centers: ManagedCenter[];
  onSaved: () => Promise<void>;
}) {
  const [barangays, setBarangays] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    adminApi("/barangays")
      .then((body) => setBarangays(body.barangays))
      .catch((e) => setError(e.message));
  }, []);
  function edit(center: ManagedCenter) {
    setEditing(center.id);
    setDraft({
      barangayId: center.barangay_id,
      name: center.name,
      address: center.address,
      latitude: String(center.latitude),
      longitude: String(center.longitude),
      capacity: String(center.capacity),
      contactInformation: center.contact_information ?? "",
      notes: center.notes ?? "",
    });
    setError("");
    setMessage("");
    document
      .getElementById("center-registration")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminApi(
        editing ? `/evacuation-centers/${editing}` : "/evacuation-centers",
        editing ? "PUT" : "POST",
        {
          ...draft,
          capacity: Number(draft.capacity),
          latitude: Number(draft.latitude),
          longitude: Number(draft.longitude),
        },
      );
      await onSaved();
      setMessage(
        editing ? "Center details updated." : "Evacuation center registered.",
      );
      setEditing(null);
      setDraft(empty);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save center.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="center-management cdrrmo-section-anchor"
      id="evacuation-centers"
    >
      <span className="eyebrow">CITYWIDE SHELTER REGISTRATION</span>
      <h2>Evacuation centers</h2>
      <p>
        Register verified centers and assign each one to its barangay. Barangays
        independently update occupancy and availability.
      </p>
      <div className="staff-stat-grid">
        <div>
          <strong>{centers.length}</strong>
          <span>Registered centers</span>
        </div>
        <div>
          <strong>
            {centers.filter((c) => c.status === "AVAILABLE").length}
          </strong>
          <span>Available</span>
        </div>
        <div>
          <strong>
            {
              centers.filter(
                (c) => c.status === "FULL" || c.status === "CLOSED",
              ).length
            }
          </strong>
          <span>Full or closed</span>
        </div>
        <div>
          <strong>{new Set(centers.map((c) => c.barangay_id)).size}</strong>
          <span>Barangays with centers</span>
        </div>
      </div>
      <form
        id="center-registration"
        className="center-registration"
        onSubmit={submit}
      >
        <h3>
          {editing ? "Edit evacuation center" : "Register evacuation center"}
        </h3>
        <fieldset disabled={busy}>
          <div className="center-field-grid">
            <label>
              Assigned barangay
              <select
                required
                value={draft.barangayId}
                onChange={(e) =>
                  setDraft({ ...draft, barangayId: e.target.value })
                }
              >
                <option value="">Select barangay</option>
                {barangays.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Center name
              <input
                required
                maxLength={500}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Address
              <input
                required
                maxLength={500}
                value={draft.address}
                onChange={(e) =>
                  setDraft({ ...draft, address: e.target.value })
                }
              />
            </label>
            <label>
              Verified evacuation capacity
              <input
                type="number"
                min={
                  editing
                    ? (centers.find((c) => c.id === editing)
                        ?.current_occupancy ?? 0)
                    : 0
                }
                max={1000000}
                required
                value={draft.capacity}
                onChange={(e) =>
                  setDraft({ ...draft, capacity: e.target.value })
                }
              />
            </label>
            <label>
              Latitude
              <input
                type="number"
                step="any"
                required
                value={draft.latitude}
                onChange={(e) =>
                  setDraft({ ...draft, latitude: e.target.value })
                }
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="any"
                required
                value={draft.longitude}
                onChange={(e) =>
                  setDraft({ ...draft, longitude: e.target.value })
                }
              />
            </label>
            <label>
              Contact information
              <input
                maxLength={500}
                value={draft.contactInformation}
                onChange={(e) =>
                  setDraft({ ...draft, contactInformation: e.target.value })
                }
              />
            </label>
            <label>
              Notes
              <textarea
                maxLength={3000}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
          </div>
          <p>
            Select the verified entrance on the map or enter its coordinates.
            Locations must be inside Santa Rosa.
          </p>
          <LocationPicker
            centers={centers}
            latitude={draft.latitude}
            longitude={draft.longitude}
            onPoint={(latitude, longitude) =>
              setDraft((d) => ({
                ...d,
                latitude: String(latitude),
                longitude: String(longitude),
              }))
            }
          />
          <div className="center-form-actions">
            <button className="primary-button" type="submit">
              {busy
                ? "Saving..."
                : editing
                  ? "Save center details"
                  : "Register center"}
            </button>
            {editing && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setDraft(empty);
                }}
              >
                Cancel editing
              </button>
            )}
          </div>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="managed-center-grid">
        {centers.map((center) => (
          <article key={center.id}>
            <h3>{center.name}</h3>
            <p>{center.barangays?.name}</p>
            <p>{center.address}</p>
            <p>
              {center.current_occupancy} / {center.capacity} occupied ·{" "}
              {center.status.replaceAll("_", " ")}
            </p>
            <div className="center-form-actions">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => edit(center)}
              >
                Edit {center.name}
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Delete ${center.name}? This removes it from public shelter recommendations.`,
                    )
                  )
                    return;
                  setBusy(true);
                  setError("");
                  try {
                    await adminApi(
                      `/evacuation-centers/${center.id}`,
                      "DELETE",
                    );
                    if (editing === center.id) {
                      setEditing(null);
                      setDraft(empty);
                    }
                    await onSaved();
                    setMessage("Center deleted.");
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Could not delete center.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete {center.name}
              </button>
            </div>
          </article>
        ))}
      </div>
      {editing && centers.find((c) => c.id === editing) && (
        <ShelterSuppliesForm
          key={editing}
          center={centers.find((c) => c.id === editing)!}
        />
      )}
    </section>
  );
}
