"use client";
import { useLanguage } from "@/components/LanguageProvider";
import type { TravelMode } from "@/lib/travelTime";
import { useAssistance } from "@/components/assistance/AssistanceProvider";

import { useId, useRef, useState } from "react";
import { Phone, X, Landmark, MapPin, Share2, ChevronRight } from "lucide-react";

const CDRRMO_HOTLINES = [
  { carrier: "Globe", number: "0995-650-1943", href: "tel:+639956501943" },
  { carrier: "Smart", number: "0999-873-5431", href: "tel:+639998735431" },
];

export function EmergencyContact({
  placement = "header",
  position,
  onFindCenter,
  routingUnavailable,
  travelMode = "walking",
}: {
  placement?: "header" | "floating" | "route";
  position: { latitude: number; longitude: number } | null;
  onFindCenter: () => void;
  routingUnavailable: string | null;
  travelMode?: TravelMode;
}) {
  const { t } = useLanguage();
  const { openRequest, hasRequest } = useAssistance();
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
        setShareStatus(
          t("Location copied. Paste it into a message to your chosen contact."),
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareStatus(
        `Could not share automatically. Your coordinates: ${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`,
      );
    }
  }

  return (
    <div className={`emergency-contact emergency-contact-${placement}`}>
      <button
        ref={trigger}
        type="button"
        className="emergency-contact-trigger"
        aria-label={t(
          placement === "route"
            ? "Emergency contact"
            : "Emergency contact information",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setShareStatus("");
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        <Phone size={18} aria-hidden="true" />
        <span>
          {t(placement === "route" ? "Emergency contact" : "Emergency")}
        </span>
      </button>
      <dialog
        ref={dialog}
        id={id}
        className="emergency-contact-dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            const controls = event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled), a[href]",
            );
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <span className="emergency-sheet-handle" aria-hidden="true" />
        <div className="emergency-contact-heading">
          <h2 id={`${id}-title`}>{t("Emergency Assistance")}</h2>
          <button
            type="button"
            autoFocus
            aria-label={t("Close emergency contact")}
            onClick={() => dialog.current?.close()}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <p id={`${id}-description`}>
          {t(
            "Choose an option for assistance, evacuation routes, or sharing your location.",
          )}
        </p>
        <div className="emergency-action-list">
          <button
            type="button"
            className="emergency-action emergency-action-agency"
            onClick={() => {
              dialog.current?.close();
              openRequest({ kind: "emergency", travelMode });
            }}
          >
            <span className="emergency-action-icon">
              <Phone size={22} aria-hidden="true" />
            </span>
            <span>
              <strong>
                {hasRequest
                  ? t("View My Assistance Request")
                  : t("Request Assistance")}
              </strong>
              <small>
                {t(
                  "Share a one-time GPS location with CDRRMO and track your request",
                )}
              </small>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <a className="emergency-action emergency-action-call" href="tel:911">
            <span className="emergency-action-icon">
              <Phone size={22} aria-hidden="true" />
            </span>
            <span>
              <strong>{t("Call 911")}</strong>
              <small>{t("National emergency hotline")}</small>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </a>
          <section
            className="emergency-action emergency-action-agency"
            aria-labelledby={`${id}-cdrrmo`}
          >
            <span className="emergency-action-icon">
              <Landmark size={22} aria-hidden="true" />
            </span>
            <div className="emergency-action-content">
              <h3 id={`${id}-cdrrmo`}>{t("Call Santa Rosa CDRRMO")}</h3>
              <div className="emergency-hotline-links">
                {CDRRMO_HOTLINES.map(({ carrier, number, href }) => (
                  <a key={carrier} href={href}>
                    <span>{carrier}</span>
                    <strong>{number}</strong>
                  </a>
                ))}
              </div>
            </div>
          </section>
          <button
            className="emergency-action emergency-action-center"
            type="button"
            disabled={!!routingUnavailable}
            onClick={() => {
              dialog.current?.close();
              onFindCenter();
            }}
          >
            <span className="emergency-action-icon">
              <MapPin size={22} aria-hidden="true" />
            </span>
            <span>
              <strong>{t("Find an evacuation center")}</strong>
              <small>
                {routingUnavailable ??
                  t("Find a reachable center using your travel mode")}
              </small>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button
            className="emergency-action emergency-action-share"
            type="button"
            disabled={!position}
            onClick={shareLocation}
          >
            <span className="emergency-action-icon">
              <Share2 size={22} aria-hidden="true" />
            </span>
            <span>
              <strong>{t("Share current location")}</strong>
              <small>
                {position
                  ? t("Share a location snapshot with a contact")
                  : t("Enable location access to share your coordinates")}
              </small>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
        {shareStatus && (
          <p role="status" className="emergency-contact-note">
            {shareStatus}
          </p>
        )}
        <p className="emergency-contact-note">
          {t("Opening this panel does not dispatch assistance.")}
        </p>
      </dialog>
    </div>
  );
}
