"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { shareAssistanceLocation, type AssistanceContext } from "@/services/api";

export function AssistancePrompt({ context }: { context: AssistanceContext }) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useRef<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (expanded) nameInput.current?.focus(); }, [expanded]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(null);
    try {
      if (!navigator.geolocation) throw new Error("Location access is unavailable on this device.");
      // A new fix is requested only after explicit consent, not on opening the form.
      const location = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Could not get a fresh location. Enable location permission and try again.")),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }));
      if (!mounted.current) return;
      id.current ??= crypto.randomUUID();
      await shareAssistanceLocation({ ...context, id: id.current, consent: true,
        start: { latitude: location.coords.latitude, longitude: location.coords.longitude },
        accuracy: location.coords.accuracy, recordedAt: new Date(location.timestamp).toISOString(),
        name: name.trim(), contact: contact.trim(),
      });
      if (mounted.current) { setSent(true); setName(""); setContact(""); }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error && cause.name !== "TimeoutError"
        ? cause.message : "Submission could not be confirmed. Retry here; the same request will not be sent twice.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (dismissed) return null;
  if (sent) return <section className="assistance-prompt" role="status">
    <strong>Location shared with the CDRRMO dashboard.</strong>
    <p>This does not confirm that staff have read it or that help has been dispatched. This is a one-time snapshot, not live tracking.</p>
    <small>Reference: {id.current}</small>
  </section>;
  return <section className="assistance-prompt" aria-label="Share location with CDRRMO">
    <p role="status"><strong>Hazards block the mapped route. Share your location with CDRRMO?</strong></p>
    {!expanded ? <div className="assistance-buttons">
      <button type="button" className="primary-button" onClick={() => setExpanded(true)}>Review sharing details</button>
      <button type="button" className="secondary-button" onClick={() => setDismissed(true)}>Not now</button>
    </div> : <form onSubmit={submit} aria-busy={busy}>
      <p id="assistance-consent">By selecting “Share my location”, you agree to send your current coordinates, location accuracy and time, destination, travel mode, and any details below to authorized CDRRMO staff. No live tracking. Submission does not guarantee assistance or dispatch.</p>
      <label>Name (optional)<input ref={nameInput} value={name} maxLength={100} autoComplete="name" disabled={busy} onChange={e => setName(e.target.value)} /></label>
      <label>Contact number (optional)<input type="tel" value={contact} maxLength={40} autoComplete="tel" disabled={busy} onChange={e => setContact(e.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <div className="assistance-buttons">
        <button type="submit" className="primary-button" disabled={busy} aria-describedby="assistance-consent">{busy ? "Sharing location…" : "Share my location"}</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => setDismissed(true)}>Cancel</button>
      </div>
      {busy && <p role="status">Getting your location and checking current hazards…</p>}
    </form>}
  </section>;
}
