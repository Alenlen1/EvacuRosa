"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import {
  ChevronDown,
  CircleCheck,
  CircleMinus,
  House,
  LockKeyhole,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { StatusBadge } from "@/components/ui/StatusBadge";
import styles from "./CenterManager.module.css";
import { useDeleteConfirmation } from "./DeleteConfirmationDialog";
import { getCdrrmoShelterStatusCounts } from "@/lib/cdrrmoShelterStatus";
import { entranceBarangay } from "@/lib/entranceBarangay";
import { getBarangayBoundary } from "../../../../backend/src/geography/barangayBoundary";

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
};

const centerFilters = [
  { status: "all", label: "All centers", icon: House },
  { status: "AVAILABLE", label: "Available", icon: CircleCheck },
  { status: "NEARLY_FULL", label: "Nearly full", icon: TriangleAlert },
  { status: "FULL", label: "Full", icon: CircleMinus },
  { status: "CLOSED", label: "Closed", icon: LockKeyhole },
] as const;

type CenterFilter = (typeof centerFilters)[number]["status"];

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
  const assignment = entranceBarangay(
    draft.latitude,
    draft.longitude,
    barangays,
    draft.barangayId,
  );
  const entranceEnabled = Boolean(
    assignment.barangay && getBarangayBoundary(assignment.barangay.name),
  );
  const [locationFeedback, setLocationFeedback] = useState("");
  const [barangaysLoading, setBarangaysLoading] = useState(true);
  const [barangaysError, setBarangaysError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CenterFilter>("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const editorRef = useRef<HTMLFormElement>(null);
  const editorTriggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef(false);

  function loadBarangays() {
    setBarangaysLoading(true);
    setBarangaysError("");
    adminApi("/barangays")
      .then((body) => {
        if (!Array.isArray(body.barangays) || !body.barangays.length)
          throw new Error("No barangays available.");
        setBarangays(body.barangays);
      })
      .catch(() =>
        setBarangaysError("Could not load barangays. Please try again."),
      )
      .finally(() => setBarangaysLoading(false));
  }

  useEffect(() => {
    loadBarangays();
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
      ?.querySelector<HTMLSelectElement>("#center-barangay")
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
    });
    setError("");
    setLocationFeedback("");
    setMessage("");
    setEditorOpen(true);
    setFocusRequest((request) => request + 1);
  }

  function cancel() {
    returnFocus.current = true;
    setEditing(null);
    setDraft(empty);
    setLocationFeedback("");
    setEditorOpen(false);
    setError("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!assignment.valid || !assignment.barangay)
        throw new Error(assignment.message);
      await adminApi(
        editing ? `/evacuation-centers/${editing}` : "/evacuation-centers",
        editing ? "PUT" : "POST",
        {
          ...draft,
          barangayId: assignment.barangay.id,
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
      setLocationFeedback("");
      setEditorOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save center.");
    } finally {
      setBusy(false);
    }
  }

  function selectBarangay(barangayId: string) {
    const keepEntrance = entranceBarangay(
      draft.latitude,
      draft.longitude,
      barangays,
      barangayId,
    ).valid;
    setDraft((current) => ({
      ...current,
      barangayId,
      ...(!keepEntrance ? { latitude: "", longitude: "" } : {}),
    }));
    setError("");
    setLocationFeedback(
      !keepEntrance && (draft.latitude || draft.longitude)
        ? "Previous entrance cleared. Select an entrance within the selected barangay."
        : "",
    );
  }

  const search = query.trim().toLocaleLowerCase();
  const searchTerms = search ? search.split(/\s+/) : [];
  const isFiltered = searchTerms.length > 0 || statusFilter !== "all";
  const visibleCenters = centers.filter((center) => {
    if (statusFilter !== "all" && center.status !== statusFilter) return false;
    const searchText = [center.name, center.barangays?.name ?? "", center.address]
      .join(" ")
      .toLocaleLowerCase();
    return searchTerms.every((term) => searchText.includes(term));
  });
  const editingCenter = centers.find((center) => center.id === editing);
  const statusCounts = getCdrrmoShelterStatusCounts(centers);
  const barangaysWithCenters = new Set(
    centers.map((center) => center.barangay_id).filter(Boolean),
  ).size;

  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }

  async function deleteCenter(center: ManagedCenter) {
    const confirmed = await confirmDelete({
      title: "Delete evacuation center?",
      subject: center.name,
      description:
        "This removes the center from the shelter directory and public recommendations. This action cannot be undone.",
      confirmLabel: "Delete center",
      cancelLabel: "Keep center",
    });
    if (!confirmed) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminApi(`/evacuation-centers/${center.id}`, "DELETE");
      if (editing === center.id) cancel();
      await onSaved();
      setMessage("Center deleted.");
      returnFocus.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete center.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`cdrrmo-panel cdrrmo-section-anchor ${styles.manager}`}
      id="evacuation-centers"
      tabIndex={-1}
      aria-labelledby="center-management-title"
    >
      <div className="cdrrmo-panel-heading">
        <div>
          <h2 id="center-management-title">Center directory</h2>
          {barangaysWithCenters > 0 && (
            <p className="cdrrmo-panel-description">
              <MapPin size={15} aria-hidden="true" />
              {barangaysWithCenters}{" "}
              {barangaysWithCenters === 1 ? "barangay" : "barangays"} with
              centers
            </p>
          )}
        </div>
        <button
          className="primary-button cdrrmo-panel-action"
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
                  : "Choose a barangay, then select the shelter entrance within its boundary."}
              </p>
            </div>
            <fieldset disabled={busy} className={styles.fields}>
              <section
                className={styles.coordinatesSection}
                aria-labelledby="center-barangay-title"
              >
                <div>
                  <h4 id="center-barangay-title">1. Choose barangay</h4>
                  <p>
                    The map will highlight its boundary. Place the entrance
                    inside the highlighted area.
                  </p>
                </div>
                <div className={styles.fieldGrid}>
                  <label className={styles.wide}>
                    Assigned barangay
                    <select
                      id="center-barangay"
                      required
                      value={draft.barangayId}
                      disabled={barangaysLoading || !!barangaysError}
                      aria-describedby="center-barangay-help"
                      onChange={(event) => selectBarangay(event.target.value)}
                    >
                      <option value="">
                        {barangaysLoading
                          ? "Loading barangays..."
                          : "Select barangay"}
                      </option>
                      {barangays.map((barangay) => (
                        <option key={barangay.id} value={barangay.id}>
                          {barangay.name}
                        </option>
                      ))}
                    </select>
                    <small id="center-barangay-help">
                      {barangaysError ||
                        (assignment.barangay
                          ? `Only entrances within ${assignment.barangay.name} can be saved.`
                          : "Select a barangay to enable the entrance map and coordinates.")}
                    </small>
                  </label>
                  {barangaysError && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={loadBarangays}
                    >
                      Retry loading barangays
                    </button>
                  )}
                </div>
              </section>
              <section
                className={styles.coordinatesSection}
                aria-labelledby="center-coordinates-title"
              >
                <div>
                  <h4 id="center-coordinates-title">2. Select entrance</h4>
                  <p>
                    {assignment.barangay
                      ? `Select the entrance on the map or enter its coordinates within ${assignment.barangay.name}.`
                      : "Choose an assigned barangay first, then select the entrance on the map or enter its coordinates."}
                  </p>
                </div>
                <div className={styles.fieldGrid}>
                  <label>
                    Latitude
                    <input
                      type="number"
                      step="any"
                      required
                      disabled={!entranceEnabled}
                      aria-describedby="center-entrance-feedback"
                      aria-invalid={
                        !!draft.latitude &&
                        !!draft.longitude &&
                        !assignment.valid
                      }
                      value={draft.latitude}
                      onChange={(e) => {
                        setDraft({ ...draft, latitude: e.target.value });
                        setLocationFeedback("");
                      }}
                    />
                  </label>
                  <label>
                    Longitude
                    <input
                      type="number"
                      step="any"
                      required
                      disabled={!entranceEnabled}
                      aria-describedby="center-entrance-feedback"
                      aria-invalid={
                        !!draft.latitude &&
                        !!draft.longitude &&
                        !assignment.valid
                      }
                      value={draft.longitude}
                      onChange={(e) => {
                        setDraft({ ...draft, longitude: e.target.value });
                        setLocationFeedback("");
                      }}
                    />
                  </label>
                </div>
              </section>
              <div className={styles.editorColumns}>
                <div className={styles.detailsSection}>
                  <h4>Center details</h4>
                  <div className={styles.fieldGrid}>
                    <label className={styles.wide}>
                      Center name
                      <input
                        id="center-name"
                        required
                        maxLength={500}
                        value={draft.name}
                        onChange={(e) =>
                          setDraft({ ...draft, name: e.target.value })
                        }
                      />
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
                  </div>
                </div>
                <div className={styles.locationSection}>
                  <h4>Entrance map</h4>
                  <p>
                    {assignment.barangay
                      ? `${assignment.barangay.name} is outlined in burgundy. Shaded areas are outside its boundary.`
                      : "Choose a barangay above to highlight its boundary and enable entrance selection."}
                  </p>
                  <p
                    id="center-entrance-feedback"
                    className={styles.entranceFeedback}
                    data-invalid={
                      !!locationFeedback ||
                      (!!draft.latitude &&
                        !!draft.longitude &&
                        !assignment.valid)
                    }
                    role="status"
                  >
                    {locationFeedback || assignment.message}
                  </p>
                  <LocationPicker
                    centers={centers}
                    latitude={draft.latitude}
                    longitude={draft.longitude}
                    barangay={assignment.barangay}
                    disabled={busy || !entranceEnabled}
                    onInvalidPoint={setLocationFeedback}
                    onPoint={(latitude, longitude) => {
                      setLocationFeedback("");
                      setDraft((current) => ({
                        ...current,
                        latitude: String(latitude),
                        longitude: String(longitude),
                      }));
                    }}
                  />
                </div>
              </div>
              <div className={styles.formActions}>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={!assignment.valid}
                >
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
      </div>
      <div className={styles.directory} hidden={editorOpen}>
        <div
          className="cdrrmo-view-controls"
          role="group"
          aria-label="Filter by status"
        >
          {centerFilters.map(({ status, label, icon: Icon }) => (
            <button
              className={`cdrrmo-view-button ${styles.filter}`}
              key={status}
              type="button"
              aria-pressed={statusFilter === status}
              data-status={status}
              onClick={() => setStatusFilter(status)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
              <span className="cdrrmo-view-count">
                {(status === "all"
                  ? centers.length
                  : statusCounts[status]
                ).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
        <div className={styles.directoryToolbar}>
          <div className={styles.search}>
            <label
              className={styles.visuallyHidden}
              htmlFor="center-directory-search"
            >
              Search by center, barangay, or address
            </label>
            <Search size={18} aria-hidden="true" />
            <input
              ref={searchRef}
              id="center-directory-search"
              type="search"
              placeholder="Search center, barangay, or address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear center search"
                onClick={clearSearch}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <p className={styles.directoryCount} role="status">
            {isFiltered
              ? `Showing ${visibleCenters.length.toLocaleString()} of ${centers.length.toLocaleString()} centers`
              : `${centers.length.toLocaleString()} registered ${centers.length === 1 ? "center" : "centers"}`}
          </p>
        </div>
        {visibleCenters.length === 0 ? (
          <div className={styles.empty}>
            <House size={24} aria-hidden="true" />
            <h3>
              {isFiltered ? "No matching centers" : "No centers registered"}
            </h3>
            {isFiltered && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  clearSearch();
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className={styles.tableFrame}>
            <table
              className={styles.table}
              role="table"
              aria-label="Registered evacuation centers"
            >
              <thead role="rowgroup" className={styles.tableHead}>
                <tr role="row">
                  <th role="columnheader" scope="col">
                    Center
                  </th>
                  <th role="columnheader" scope="col">
                    Status
                  </th>
                  <th role="columnheader" scope="col">
                    Occupancy
                  </th>
                  <th role="columnheader" scope="col">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {visibleCenters.map((center) => {
                  const occupancy = nonNegativeInteger(center.current_occupancy);
                  const capacity = nonNegativeInteger(center.capacity);
                  const barPercent =
                    capacity && occupancy !== null
                      ? Math.min(100, (occupancy / capacity) * 100)
                      : undefined;

                  return (
                    <tr className={styles.centerRow} role="row" key={center.id}>
                      <th role="rowheader" scope="row">
                        <div className={styles.centerIdentity}>
                          <strong>{center.name}</strong>
                          <span>
                            {center.barangays?.name || "Barangay not assigned"}
                          </span>
                          {center.address && (
                            <span className={styles.address}>{center.address}</span>
                          )}
                        </div>
                      </th>
                      <td className={styles.statusCell} role="cell">
                        <StatusBadge status={center.status} />
                      </td>
                      <td className={styles.occupancy} role="cell">
                        <span className={styles.mobileLabel}>Occupancy</span>
                        <div className={styles.occupancyCount}>
                          <strong>{occupancy?.toLocaleString() ?? "—"}</strong>
                          <span> / {capacity?.toLocaleString() ?? "—"}</span>
                        </div>
                        {barPercent !== undefined && (
                          <div
                            className={styles.capacityTrack}
                            role="progressbar"
                            aria-label={`${center.name} occupancy`}
                            aria-valuenow={barPercent}
                            aria-valuetext={`${occupancy} of ${capacity} spaces occupied`}
                          >
                            <span
                              style={{ width: `${barPercent}%` }}
                              data-status={center.status}
                            />
                          </div>
                        )}
                      </td>
                      <td className={styles.actionCell} role="cell">
                        <div className={styles.rowActions}>
                          <button
                            className="secondary-button"
                            disabled={busy}
                            type="button"
                            aria-label={`Edit ${center.name}`}
                            onClick={() => edit(center)}
                          >
                            <Pencil size={15} aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            className={styles.deleteButton}
                            disabled={busy}
                            type="button"
                            aria-label={`Delete ${center.name}`}
                            onClick={() => void deleteCenter(center)}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {deleteDialog}
    </section>
  );
}
