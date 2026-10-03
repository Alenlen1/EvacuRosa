"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type SupplyStatus = "unknown" | "adequate" | "low" | "unavailable";
export interface ShelterSupplyRecord {
  id: string;
  water_status?: SupplyStatus;
  food_status?: SupplyStatus;
  medical_status?: SupplyStatus;
  supplies_updated_at?: string | null;
}

export function ShelterSuppliesForm({ center }: { center: ShelterSupplyRecord }) {
  const [waterStatus, setWater] = useState(center.water_status ?? "unknown");
  const [foodStatus, setFood] = useState(center.food_status ?? "unknown");
  const [medicalStatus, setMedical] = useState(center.medical_status ?? "unknown");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return <form className="shelter-supplies-form" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Sign in again to update supplies.");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/admin/evacuation-centers/${encodeURIComponent(center.id)}`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000), body: JSON.stringify({ waterStatus, foodStatus, medicalStatus }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not save supplies.");
      setMessage("Supply information confirmed and saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save supplies."); }
    finally { setBusy(false); }
  }}>
    <fieldset disabled={busy}><legend>Shelter supplies</legend>
      {([
        ["Drinking water", waterStatus, setWater], ["Food", foodStatus, setFood], ["First aid", medicalStatus, setMedical],
      ] as const).map(([label, value, update]) => <label key={label}>{label}
        <select value={value} onChange={event => update(event.target.value as SupplyStatus)}>
          <option value="unknown">Unknown</option><option value="adequate">Adequate</option>
          <option value="low">Low</option><option value="unavailable">Unavailable</option>
        </select>
      </label>)}
      <button className="secondary-button" type="submit">{busy ? "Saving…" : "Confirm supply information"}</button>
    </fieldset>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </form>;
}
