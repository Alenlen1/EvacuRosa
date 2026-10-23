import { MapPin, UsersRound } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { EvacuationCenter } from "@/services/api";

const people = new Intl.NumberFormat("en-PH");

export function BarangayShelterPopup({ center }: { center: EvacuationCenter }) {
  const occupancy =
    Number.isFinite(center.currentOccupancy) && center.currentOccupancy >= 0
      ? center.currentOccupancy
      : null;
  const capacity =
    Number.isFinite(center.capacity) && center.capacity > 0
      ? center.capacity
      : null;
  const percentage =
    occupancy !== null && capacity !== null
      ? (occupancy / capacity) * 100
      : null;

  return (
    <article className="barangay-shelter-popup" data-status={center.status}>
      <div className="barangay-shelter-popup-heading">
        <span className="barangay-shelter-popup-kicker">Evacuation center</span>
        <h3>{center.name}</h3>
        <StatusBadge status={center.status} />
      </div>
      <p className="barangay-shelter-popup-address">
        <MapPin size={15} aria-hidden="true" />
        <span>{center.address?.trim() || "Address not provided"}</span>
      </p>
      <div className="barangay-shelter-popup-occupancy">
        <span className="barangay-shelter-popup-label">
          <UsersRound size={15} aria-hidden="true" />
          Current occupancy
        </span>
        <p className="barangay-shelter-popup-count">
          {occupancy !== null ? (
            <>
              <strong>{people.format(occupancy)}</strong>
              <span>
                {capacity !== null ? ` / ${people.format(capacity)}` : ""}{" "}
                people
              </span>
            </>
          ) : (
            <span>Occupancy not reported</span>
          )}
        </p>
        {percentage !== null && occupancy !== null && capacity !== null ? (
          <>
            <div
              className="barangay-shelter-popup-meter"
              role="progressbar"
              aria-label={`${center.name} occupancy`}
              aria-valuemin={0}
              aria-valuemax={capacity}
              aria-valuenow={Math.min(occupancy, capacity)}
              aria-valuetext={`${people.format(occupancy)} of ${people.format(capacity)} people${occupancy > capacity ? ", over capacity" : ""}`}
            >
              <span style={{ width: `${Math.min(100, percentage)}%` }} />
            </div>
            <span className="barangay-shelter-popup-capacity">
              {Math.round(percentage)}% occupied
            </span>
          </>
        ) : (
          <span className="barangay-shelter-popup-capacity">
            {capacity !== null
              ? `Capacity: ${people.format(capacity)} people`
              : "Capacity not reported"}
          </span>
        )}
      </div>
    </article>
  );
}
