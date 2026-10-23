"use client";

import { useId, useState, type FormEvent } from "react";
import { Check, CircleAlert, Clock3, House, MapPin, Save } from "lucide-react";
import type { ManagedCenter } from "./CenterManager";
import styles from "./BarangayWorkspaceCenter.module.css";

type WorkspaceCenter = ManagedCenter & { updated_at?: string | null };

interface BarangayWorkspaceCenterProps {
  center: WorkspaceCenter;
  occupancyDraft: string;
  availabilityDraft: string;
  saving: boolean;
  updatesDisabled: boolean;
  feedback?: { kind: "success" | "error"; message: string };
  onOccupancyChange: (value: string) => void;
  onAvailabilityChange: (value: string) => void;
  onSave: () => void;
}

const count = new Intl.NumberFormat("en-PH");
const timestamp = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function BarangayWorkspaceCenter({
  center,
  occupancyDraft,
  availabilityDraft,
  saving,
  updatesDisabled,
  feedback,
  onOccupancyChange,
  onAvailabilityChange,
  onSave,
}: BarangayWorkspaceCenterProps) {
  const fieldId = useId();
  const [occupancyTouched, setOccupancyTouched] = useState(false);
  const capacityKnown = isCount(center.capacity);
  const occupancyKnown = isCount(center.current_occupancy);
  const ratioKnown = capacityKnown && center.capacity > 0 && occupancyKnown;
  const percent = ratioKnown
    ? Math.round((center.current_occupancy / center.capacity) * 100)
    : null;
  const barPercent = percent === null ? 0 : Math.min(100, percent);
  const savedStatus = center.status?.replaceAll("_", " ").toUpperCase();
  const status = ["AVAILABLE", "NEARLY FULL", "FULL", "CLOSED"].includes(
    savedStatus,
  )
    ? savedStatus
    : "STATUS UNAVAILABLE";
  const closed = status === "CLOSED";
  const open = ["AVAILABLE", "NEARLY FULL"].includes(status);
  const remaining =
    capacityKnown && occupancyKnown
      ? Math.max(0, center.capacity - center.current_occupancy)
      : null;

  const draftCount = Number(occupancyDraft);
  const draftHasValue = occupancyDraft.trim() !== "";
  const integerValid = draftHasValue && isCount(draftCount);
  const draftValid =
    integerValid && capacityKnown && draftCount <= center.capacity;
  const availabilityValid = ["AVAILABLE", "CLOSED"].includes(availabilityDraft);
  const savedAvailability = closed ? "CLOSED" : "AVAILABLE";
  const dirty =
    (integerValid
      ? draftCount !== center.current_occupancy
      : occupancyDraft !== String(center.current_occupancy)) ||
    availabilityDraft !== savedAvailability;
  const inputError = !capacityKnown
    ? "A verified capacity is needed before occupancy can be updated."
    : !integerValid
      ? "Enter a whole number of people, starting at 0."
      : draftCount > center.capacity
        ? `Occupancy cannot exceed the capacity of ${count.format(center.capacity)} people.`
        : "";
  const showInputError = occupancyTouched && Boolean(inputError);
  const savedDate = center.updated_at ? new Date(center.updated_at) : null;
  const dateValid = savedDate !== null && !Number.isNaN(savedDate.getTime());

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOccupancyTouched(true);
    if (!draftValid || !availabilityValid || !dirty || updatesDisabled) return;
    onSave();
  }

  return (
    <article
      id={`center-${center.id}`}
      className={`barangay-center-card ${styles.card}`}
      aria-labelledby={`${fieldId}-name`}
      aria-busy={saving}
    >
      <header className={styles.header}>
        <span className={styles.shelterIcon} aria-hidden="true">
          <House size={22} strokeWidth={1.7} />
        </span>
        <div className={styles.identity}>
          <p className={styles.eyebrow}>Evacuation center</p>
          <h2 id={`${fieldId}-name`}>{center.name}</h2>
          {center.address?.trim() && (
            <p className={styles.address}>
              <MapPin size={14} aria-hidden="true" />
              <span>{center.address}</span>
            </p>
          )}
        </div>
        <span className="barangay-center-status" data-status={status}>
          <span className={styles.statusDot} aria-hidden="true" />
          {status}
        </span>
      </header>

      <div className={styles.body}>
        <section
          className={styles.occupancy}
          aria-labelledby={`${fieldId}-occupancy-title`}
        >
          <h3 id={`${fieldId}-occupancy-title`}>Current occupancy</h3>
          <p className={styles.occupancyCount}>
            <strong>
              {occupancyKnown ? count.format(center.current_occupancy) : "—"}
            </strong>
            <span>
              / {capacityKnown ? count.format(center.capacity) : "—"} people
            </span>
          </p>
          <p className={styles.percentage}>
            {percent !== null
              ? `${count.format(percent)}% occupied`
              : !occupancyKnown
                ? "Occupancy unavailable"
                : "Occupancy percentage unavailable"}
          </p>
          {ratioKnown ? (
            <div
              className={styles.progress}
              role="progressbar"
              aria-label={`${center.name} occupancy`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={barPercent}
              aria-valuetext={`${count.format(center.current_occupancy)} of ${count.format(center.capacity)} people, ${count.format(percent!)}% occupied`}
              data-status={status}
            >
              <div style={{ width: `${barPercent}%` }} />
            </div>
          ) : (
            <div className={styles.emptyProgress} aria-hidden="true" />
          )}
          <p className={styles.remaining}>
            {closed ? (
              "Closed to new arrivals"
            ) : status === "FULL" ? (
              "Not accepting new arrivals"
            ) : open && remaining !== null ? (
              <>
                <strong>{count.format(remaining)}</strong> remaining spaces
              </>
            ) : (
              "Remaining spaces unavailable"
            )}
          </p>
          <p className={styles.updated}>
            <Clock3 size={14} aria-hidden="true" />
            {dateValid ? (
              <span>
                Last updated{" "}
                <time dateTime={savedDate.toISOString()}>
                  {timestamp.format(savedDate)}
                </time>
              </span>
            ) : (
              <span>Update time unavailable</span>
            )}
          </p>
        </section>

        <form
          className={styles.form}
          aria-label={`Update ${center.name}`}
          onSubmit={submit}
          noValidate
        >
          <div className={styles.formHeading}>
            <h3>Update center</h3>
            {dirty && !saving && (
              <span className={styles.unsaved}>Unsaved changes</span>
            )}
          </div>
          <label htmlFor={`${fieldId}-availability`}>Availability</label>
          <select
            id={`${fieldId}-availability`}
            value={availabilityDraft}
            onChange={(event) => onAvailabilityChange(event.target.value)}
            disabled={updatesDisabled}
          >
            <option value="AVAILABLE">Open</option>
            <option value="CLOSED">Closed</option>
          </select>
          <p className={styles.capacityHint}>
            Capacity status is based on occupancy.
          </p>
          <label htmlFor={`${fieldId}-occupancy`}>Update occupancy</label>
          <div className={styles.inputWrap}>
            <input
              id={`${fieldId}-occupancy`}
              type="number"
              inputMode="numeric"
              min={0}
              max={capacityKnown ? center.capacity : undefined}
              step={1}
              required
              value={occupancyDraft}
              onChange={(event) => {
                setOccupancyTouched(true);
                onOccupancyChange(event.target.value);
              }}
              onBlur={() => setOccupancyTouched(true)}
              disabled={updatesDisabled}
              aria-invalid={showInputError || undefined}
              aria-describedby={
                showInputError ? `${fieldId}-input-error` : undefined
              }
            />
            <span aria-hidden="true">people</span>
          </div>
          {showInputError && (
            <p id={`${fieldId}-input-error`} className={styles.inputError}>
              {inputError}
            </p>
          )}
          <button
            type="submit"
            className={`barangay-save-button ${styles.save}`}
            disabled={
              updatesDisabled || !dirty || !draftValid || !availabilityValid
            }
          >
            <Save size={17} aria-hidden="true" />
            {saving ? "Saving…" : "Save changes"}
          </button>
          {feedback && (
            <p
              className={styles.feedback}
              data-kind={feedback.kind}
              role={feedback.kind === "error" ? "alert" : "status"}
            >
              {feedback.kind === "error" ? (
                <CircleAlert size={16} aria-hidden="true" />
              ) : (
                <Check size={16} aria-hidden="true" />
              )}
              <span>{feedback.message}</span>
            </p>
          )}
        </form>
      </div>
    </article>
  );
}
