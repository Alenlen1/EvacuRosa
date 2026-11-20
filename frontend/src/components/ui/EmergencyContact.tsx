"use client";
import { useLanguage } from "@/components/LanguageProvider";
import type { TravelMode } from "@/lib/travelTime";
import { useAssistance } from "@/components/assistance/AssistanceProvider";

import { useId, useRef, useState } from "react";
import {
  ChevronRight,
  HandHeart,
  Landmark,
  MapPin,
  Phone,
  PhoneCall,
  Share2,
  X,
} from "lucide-react";

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
    const coordinates = `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`;
    const text = t("My current location: {coordinates}", { coordinates });
    const url = `https://www.openstreetmap.org/?mlat=${position.latitude}&mlon=${position.longitude}#map=18/${position.latitude}/${position.longitude}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: t("My location"), text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareStatus(
          t("Location copied. Paste it into a message to your chosen contact."),
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareStatus(
        t("Could not share your location. Coordinates: {coordinates}", {
          coordinates,
        }),
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
        <div className="emergency-contact-body">
          <a className="emergency-action emergency-action-call" href="tel:911">
            <span className="emergency-action-icon">
              <PhoneCall size={22} aria-hidden="true" />
            </span>
            <span className="emergency-action-copy">
              <strong>{t("Call 911")}</strong>
              <small>{t("National emergency hotline")}</small>
            </span>
            <ChevronRight
              className="emergency-action-arrow"
              size={18}
              aria-hidden="true"
            />
          </a>
          <section
            className="emergency-hotlines"
            aria-labelledby={`${id}-cdrrmo`}
          >
            <h3 id={`${id}-cdrrmo`}>
              <Landmark size={16} aria-hidden="true" />
              {t("Call Santa Rosa CDRRMO")}
            </h3>
            <div className="emergency-hotline-links">
              {CDRRMO_HOTLINES.map(({ carrier, number, href }) => (
                <a
                  key={carrier}
                  href={href}
                  aria-label={t("Call {carrier} at {number}", { carrier, number })}
                >
                  <span className="emergency-hotline-carrier">
                    {carrier}
                    <Phone size={14} aria-hidden="true" />
                  </span>
                  <strong>{number}</strong>
                </a>
              ))}
            </div>
          </section>
          <div className="emergency-action-list">
            <button
              type="button"
              className="emergency-action"
              onClick={() => {
                dialog.current?.close();
                openRequest({ kind: "emergency", travelMode });
              }}
            >
              <span className="emergency-action-icon">
                <HandHeart size={19} aria-hidden="true" />
              </span>
              <span className="emergency-action-copy">
                <strong>
                  {hasRequest
                    ? t("View My Assistance Request")
                    : t("Request Assistance")}
                </strong>
                <small>
                  {hasRequest
                    ? t("Check your request status")
                    : t("Review and send your location to CDRRMO")}
                </small>
              </span>
              <ChevronRight
                className="emergency-action-arrow"
                size={18}
                aria-hidden="true"
              />
            </button>
            <button
              className="emergency-action"
              type="button"
              disabled={!!routingUnavailable}
              onClick={() => {
                dialog.current?.close();
                onFindCenter();
              }}
            >
              <span className="emergency-action-icon">
                <MapPin size={19} aria-hidden="true" />
              </span>
              <span className="emergency-action-copy">
                <strong>{t("Find an evacuation center")}</strong>
                <small>
                  {routingUnavailable ?? t("Find a route using your travel mode")}
                </small>
              </span>
              {!routingUnavailable && (
                <ChevronRight
                  className="emergency-action-arrow"
                  size={18}
                  aria-hidden="true"
                />
              )}
            </button>
            <button
              className="emergency-action"
              type="button"
              disabled={!position}
              onClick={shareLocation}
            >
              <span className="emergency-action-icon">
                <Share2 size={19} aria-hidden="true" />
              </span>
              <span className="emergency-action-copy">
                <strong>{t("Share current location")}</strong>
                <small>
                  {position
                    ? t("Share a map link with a contact")
                    : t("Enable location access to share")}
                </small>
              </span>
              {position && (
                <ChevronRight
                  className="emergency-action-arrow"
                  size={18}
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
          <div role="status" className="emergency-share-status">
            {shareStatus}
          </div>
        </div>
      </dialog>
    </div>
  );
}
