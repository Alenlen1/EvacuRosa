"use client";

import { useId, useRef, useState } from "react";
import { Phone, X, Landmark, MapPin, Share2, ChevronRight } from "lucide-react";

export function EmergencyContact({ placement = "header", position, onFindCenter, routingUnavailable }: {
  placement?: "header" | "floating";
  position: { latitude: number; longitude: number } | null;
  onFindCenter: () => void;
  routingUnavailable: string | null;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  async function shareLocation() {
    if (!position) return;
    const text = `My current location: ${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`;
    const url = `https://www.openstreetmap.org/?mlat=${position.latitude}&mlon=${position.longitude}#map=18/${position.latitude}/${position.longitude}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My location", text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareStatus("Location copied. Paste it into a message to your chosen contact.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareStatus(`Could not share automatically. Your coordinates: ${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`);
    }
  }

  return <div className={`emergency-contact emergency-contact-${placement}`}>
    <button ref={trigger} type="button" className="emergency-contact-trigger"
      aria-label="Emergency contact information" aria-haspopup="dialog"
      aria-expanded={open} aria-controls={id}
      onClick={() => { setShareStatus(""); dialog.current?.showModal(); setOpen(true); }}>
      <Phone size={18} aria-hidden="true" /><span>Emergency</span>
    </button>
    <dialog ref={dialog} id={id} className="emergency-contact-dialog"
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onClose={() => { setOpen(false); trigger.current?.focus(); }}
      onKeyDown={event => {
        if (event.key === "Tab") {
          const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <span className="emergency-sheet-handle" aria-hidden="true" />
      <div className="emergency-contact-heading">
        <h2 id={`${id}-title`}>Emergency Assistance</h2>
        <button type="button" autoFocus aria-label="Close emergency contact"
          onClick={() => dialog.current?.close()}><X size={22} aria-hidden="true" /></button>
      </div>
      <p id={`${id}-description`}>Choose an option for assistance, evacuation routes, or sharing your location.</p>
      <div className="emergency-action-list">
        <button className="emergency-action emergency-action-call" type="button" disabled>
          <span className="emergency-action-icon"><Phone size={22} aria-hidden="true" /></span>
          <span><strong>Call emergency services</strong><small>Number pending verification · Calling unavailable</small></span>
        </button>
        <button className="emergency-action emergency-action-agency" type="button" disabled>
          <span className="emergency-action-icon"><Landmark size={22} aria-hidden="true" /></span>
          <span><strong>Call Santa Rosa CDRRMO</strong><small>Number pending verification · Calling unavailable</small></span>
        </button>
        <button className="emergency-action emergency-action-center" type="button" disabled={!!routingUnavailable}
          onClick={() => { dialog.current?.close(); onFindCenter(); }}>
          <span className="emergency-action-icon"><MapPin size={22} aria-hidden="true" /></span>
          <span><strong>Find an evacuation center</strong><small>{routingUnavailable ?? "Find a reachable center using your travel mode"}</small></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button className="emergency-action emergency-action-share" type="button" disabled={!position} onClick={shareLocation}>
          <span className="emergency-action-icon"><Share2 size={22} aria-hidden="true" /></span>
          <span><strong>Share current location</strong><small>{position ? "Share a location snapshot with a contact" : "Enable location access to share your coordinates"}</small></span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      {shareStatus && <p role="status" className="emergency-contact-note">{shareStatus}</p>}
      <p className="emergency-contact-note">Opening this panel does not dispatch assistance.</p>
    </dialog>
  </div>;
}
