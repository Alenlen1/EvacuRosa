"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import {
  ChevronDown,
  CircleCheck,
  CircleMinus,
  House,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ShelterSuppliesForm } from "./ShelterSuppliesForm";
import styles from "./CenterManager.module.css";
import { useDeleteConfirmation } from "./DeleteConfirmationDialog";
import { isAcceptingCenter } from "@/lib/barangayWorkspaceSummary";

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

function nonNegativeInteger(value: number): number | null {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function CenterManager({
  centers,
  onSaved,
}: {
  centers: ManagedCenter[];
  onSaved: () => Promise<void>;
}) {
  const { confirmDelete, deleteDialog } = useDeleteConfirmation();
  const [barangays, setBarangays] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const editorRef = useRef<HTMLFormElement>(null);
  const editorTriggerRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    adminApi("/barangays")
      .then((body) => setBarangays(body.barangays))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!editorOpen) return;
    editorRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
    editorRef.current
      ?.querySelector<HTMLSelectElement>("select")
      ?.focus({ preventScroll: true });
  }, [editorOpen, focusRequest]);

  useEffect(() => {
    if (!editorOpen && !busy && returnFocus.current) {
      returnFocus.current = false;
      editorTriggerRef.current?.focus({ preventScroll: true });
    }
  }, [editorOpen, busy]);

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
    setEditorOpen(true);
    setFocusRequest((request) => request + 1);
  }

  function cancel() {
    returnFocus.current = true;
    setEditing(null);
    setDraft(empty);
    setEditorOpen(false);
    setError("");
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
      returnFocus.current = true;
      setEditing(null);
      setDraft(empty);
      setEditorOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save center.");
    } finally {
      setBusy(false);
    }
  }

  const search = query.trim().toLocaleLowerCase();
  const visibleCenters = centers.filter((center) =>
    [center.name, center.barangays?.name ?? "", center.address]
      .join(" ")
      .toLocaleLowerCase()
      .includes(search),
  );
  const editingCenter = centers.find((center) => center.id === editing);
  const stats = [
    {
      label: "Registered centers",
      count: centers.length,
      icon: House,
      tone: "brand",
    },
    {
      label: "Available",
      count: centers.filter(isAcceptingCenter).length,
      icon: CircleCheck,
      tone: "safe",
    },
    {
      label: "Full or closed",
      count: centers.filter(
        (center) => center.status === "FULL" || center.status === "CLOSED",
      ).length,
      icon: CircleMinus,
      tone: "neutral",
    },
    {
      label: "Barangays with centers",
      count: new Set(centers.map((center) => center.barangay_id)).size,
      icon: MapPin,
      tone: "brand",
    },
  ];

  return (
    <section
      className={`center-management cdrrmo-section-anchor ${styles.manager}`}
      id="evacuation-centers"
      data-editing={editorOpen}
      tabIndex={-1}
      aria-labelledby="center-management-title"
    >
      <div className={styles.sectionHeading}>
        <div className={styles.headingCopy}>
          <span className={styles.sectionIcon}>
            <House size={22} aria-hidden="true" />
          </span>
          <div>
            <span className="eyebrow">SHELTER MANAGEMENT</span>
            <h2 id="center-management-title">
              Evacuation centers{" "}
              <span className={styles.count}>{centers.length}</span>
            </h2>
            <p>
              Register verified centers and manage their details. Barangays
              update occupancy and availability.
            </p>
          </div>
        </div>
        <button
          className={`primary-button ${styles.registerButton}`}
          ref={editorTriggerRef}
          type="button"
          aria-expanded={editorOpen}
          aria-controls="center-editor"
          disabled={busy}
          onClick={() => {
            setMessage("");
            setEditorOpen((open) => !open);
          }}
        >
          {editorOpen ? (
            <ChevronDown size={18} aria-hidden="true" />
          ) : (
            <Plus size={18} aria-hidden="true" />
          )}
          {editorOpen
            ? "Hide editor"
            : editing
              ? "Continue editing"
              : "Register center"}
        </button>
      </div>
      <div className={styles.stats} role="list" aria-label="Center overview">
        {stats.map(({ label, count, icon: Icon, tone }) => (
          <div className={styles.stat} key={label} role="listitem">
            <span className={styles.statIcon} data-tone={tone}>
              <Icon size={20} aria-hidden="true" />
            </span>
            <dl>
              <dt>{label}</dt>
              <dd>{count.toLocaleString()}</dd>
            </dl>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className={styles.success}>
          <CircleCheck size={17} aria-hidden="true" />
          {message}
        </p>
      )}
      <div id="center-editor" className={styles.editor} hidden={!editorOpen}>
        {editorOpen && (
          <form
            id="center-registration"
            className={`center-registration ${styles.form}`}
            onSubmit={submit}
            ref={editorRef}
          >
            <div className={styles.editorHeading}>
              <h3>
                {editing
                  ? "Edit evacuation center"
                  : "Register evacuation center"}
              </h3>
              <p>
                {editing
                  ? "Update the verified details for this center."
                  : "Add a verified shelter and assign its barangay."}
              </p>
            </div>
            <fieldset disabled={busy} className={styles.fields}>
              <div className={styles.editorColumns}>
                <div className={styles.detailsSection}>
                  <h4>Center details</h4>
                  <div className={styles.fieldGrid}>
                    <label className={styles.wide}>
                      Center name
                      <input
                        required
                        maxLength={500}
                        value={draft.name}
                        onChange={(e) =>
                          setDraft({ ...draft, name: e.target.value })
                        }
                      />
                    </label>
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
                        {barangays.map((barangay) => (
                          <option key={barangay.id} value={barangay.id}>
                            {barangay.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Verified evacuation capacity
                      <input
                        type="number"
                        min={
                          editing ? (editingCenter?.current_occupancy ?? 0) : 0
                        }
                        max={1000000}
                        required
                        value={draft.capacity}
                        onChange={(e) =>
                          setDraft({ ...draft, capacity: e.target.value })
                        }
                      />
                    </label>
                    <label className={styles.wide}>
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
                    <label className={styles.wide}>
                      Contact information
                      <input
                        maxLength={500}
                        value={draft.contactInformation}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            contactInformation: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className={styles.wide}>
                      Notes
                      <textarea
                        maxLength={3000}
                        rows={3}
                        value={draft.notes}
                        onChange={(e) =>
                          setDraft({ ...draft, notes: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </div>
                <div className={styles.locationSection}>
                  <h4>Verified entrance</h4>
                  <p>
                    Select the entrance on the map or enter its coordinates.
                    Locations must be inside Santa Rosa.
                  </p>
                  <LocationPicker
                    centers={centers}
                    latitude={draft.latitude}
                    longitude={draft.longitude}
                    onPoint={(latitude, longitude) =>
                      setDraft((current) => ({
                        ...current,
                        latitude: String(latitude),
                        longitude: String(longitude),
                      }))
                    }
                  />
                  <div className={styles.fieldGrid}>
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
                  </div>
                </div>
              </div>
              <div className={styles.formActions}>
                <button className="primary-button" type="submit">
                  {busy
                    ? "Saving..."
                    : editing
                      ? "Save center details"
                      : "Register center"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={cancel}
                >
                  {editing ? "Cancel editing" : "Cancel"}
                </button>
              </div>
            </fieldset>
          </form>
        )}
        {editingCenter && (
          <details key={editingCenter.id} className={styles.supplies}>
            <summary>
              <span>
                Shelter supplies <small>{editingCenter.name}</small>
              </span>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <ShelterSuppliesForm
              key={editingCenter.id}
              center={editingCenter}
            />
          </details>
        )}
      </div>
      <div className={styles.directoryToolbar}>
        <h3>
          Registered centers{" "}
          <span className={styles.directoryCount}>
            {search
              ? `${visibleCenters.length} of ${centers.length}`
              : centers.length}
          </span>
        </h3>
        <div className={styles.search}>
          <label
            className={styles.visuallyHidden}
            htmlFor="center-directory-search"
          >
            Search registered centers
          </label>
          <Search size={18} aria-hidden="true" />
          <input
            id="center-directory-search"
            type="search"
            placeholder="Search center or barangay"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear center search"
              onClick={() => setQuery("")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <div className={styles.centerGrid}>
        {visibleCenters.map((center) => {
          const occupancy = nonNegativeInteger(center.current_occupancy);
          const capacity = nonNegativeInteger(center.capacity);
          const percent =
            capacity !== null && capacity > 0 && occupancy !== null
              ? Math.round((occupancy / capacity) * 100)
              : null;
          const barPercent =
            percent === null ? undefined : Math.min(100, percent);
          return (
            <article className={styles.centerCard} key={center.id}>
              <div className={styles.cardHeading}>
                <span className={styles.cardIcon}>
                  <House size={20} aria-hidden="true" />
                </span>
                <div>
                  <p className={styles.barangay}>
                    {center.barangays?.name || "Barangay not assigned"}
                  </p>
                  <h4>{center.name}</h4>
                </div>
              </div>
              <div className={styles.centerMeta}>
                <StatusBadge status={center.status} />
                <span>
                  <MapPin size={14} aria-hidden="true" />
                  {center.address}
                </span>
              </div>
              <div className={styles.occupancy}>
                <div>
                  <span>Current occupancy</span>
                  <strong>
                    {occupancy?.toLocaleString() ?? "—"}{" "}
                    <span>/ {capacity?.toLocaleString() ?? "—"}</span>
                  </strong>
                </div>
                <div
                  className={styles.capacityTrack}
                  role="progressbar"
                  aria-label={`${center.name} occupancy`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={barPercent}
                  aria-valuetext={
                    percent === null
                      ? "Occupancy percentage unavailable"
                      : `${occupancy} of ${capacity} spaces occupied (${percent}%)`
                  }
                >
                  {barPercent !== undefined && (
                    <span
                      style={{ width: `${barPercent}%` }}
                      data-status={center.status}
                    />
                  )}
                </div>
                <p>
                  {percent !== null
                    ? `${percent}% occupied`
                    : capacity === null || capacity === 0
                      ? "Capacity not set"
                      : "Occupancy unavailable"}
                </p>
              </div>
              <div className={styles.cardActions}>
                <button
                  className="secondary-button"
                  disabled={busy}
                  type="button"
                  aria-label={`Edit ${center.name}`}
                  onClick={() => edit(center)}
                >
                  <Pencil size={15} aria-hidden="true" />
                  Edit center
                </button>
                <button
                  className={styles.deleteButton}
                  disabled={busy}
                  type="button"
                  aria-label={`Delete ${center.name}`}
                  onClick={async () => {
                    if (
                      !(await confirmDelete({
                        title: "Delete evacuation center?",
                        subject: center.name,
                        description:
                          "This removes the center from the shelter directory and public recommendations. This action cannot be undone.",
                        confirmLabel: "Delete center",
                      }))
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
                        returnFocus.current = true;
                        setEditing(null);
                        setDraft(empty);
                        setEditorOpen(false);
                      }
                      await onSaved();
                      setMessage("Center deleted.");
                      returnFocus.current = true;
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
                  <Trash2 size={15} aria-hidden="true" />
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {visibleCenters.length === 0 && (
        <div className={styles.empty}>
          <House size={28} aria-hidden="true" />
          <h4>
            {search
              ? "No centers match your search"
              : "No evacuation centers registered"}
          </h4>
          <p>
            {search
              ? "Try another center name, barangay, or address."
              : "Register a verified center to start building the city shelter directory."}
          </p>
          {search && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => setQuery("")}
            >
              Clear search
            </button>
          )}
        </div>
      )}
      {deleteDialog}
    </section>
  );
}
