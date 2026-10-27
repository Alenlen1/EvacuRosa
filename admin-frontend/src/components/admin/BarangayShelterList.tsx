import { House, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { EvacuationCenter } from "@/services/api";
import { RecordsSkeleton } from "./LoadingSkeleton";

function ShelterRow({ center }: { center: EvacuationCenter }) {
  return (
    <li className="barangay-shelter-row">
      <House size={17} aria-hidden="true" />
      <div>
        <strong>{center.name}</strong>
        <StatusBadge status={center.status} />
      </div>
    </li>
  );
}

export function BarangayShelterList({
  barangay,
  centers,
  loading,
  error,
}: {
  barangay: { id: string; name: string };
  centers: EvacuationCenter[] | null;
  loading: boolean;
  error: string;
}) {
  const shelters = (centers ?? []).filter(
    (center) => center.barangayId === barangay.id,
  );
  const available = !loading && !error && centers !== null;
  const remaining = shelters.slice(3);

  return (
    <section
      className="barangay-shelter-list"
      aria-label={`Shelters in ${barangay.name}`}
      aria-busy={loading}
    >
      <div className="barangay-shelter-list-heading">
        <h3>Local shelters</h3>
        {available && <span>{shelters.length}</span>}
      </div>
      {loading ? (
        <RecordsSkeleton label="Loading shelters..." />
      ) : !available ? (
        <p className="barangay-shelter-list-message" role="status">
          Shelter list unavailable. Refresh the map to try again.
        </p>
      ) : shelters.length === 0 ? (
        <div className="barangay-shelter-empty">
          <span className="barangay-empty-illustration" aria-hidden="true">
            <House size={32} strokeWidth={1.4} />
            <MapPin size={17} />
          </span>
          <strong>No shelters registered yet</strong>
          <p>
            There are no shelters listed for {barangay.name}. You can still open
            your workspace above.
          </p>
        </div>
      ) : (
        <>
          <ul>
            {shelters.slice(0, 3).map((center) => (
              <ShelterRow key={center.id} center={center} />
            ))}
          </ul>
          {remaining.length > 0 && (
            <details key={barangay.id} className="barangay-shelters-more">
              <summary>
                View {remaining.length} more{" "}
                {remaining.length === 1 ? "shelter" : "shelters"}
              </summary>
              <ul>
                {remaining.map((center) => (
                  <ShelterRow key={center.id} center={center} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
