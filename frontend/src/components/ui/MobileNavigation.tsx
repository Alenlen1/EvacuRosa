"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Building2, Check, Map, Menu, ShieldAlert, X } from "lucide-react";

type Section = "map" | "centers" | "hazards";
const sections = [
  { id: "map", label: "Map", icon: Map },
  { id: "centers", label: "Evacuation Centers", icon: Building2 },
  { id: "hazards", label: "Hazard Information", icon: ShieldAlert },
] as const;

export function MobileNavigation({ activeSection, onSelect }: {
  activeSection: Section;
  onSelect: (section: Section) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 800px)");
    const closeOnDesktop = () => {
      if (!mobile.matches && dialog.current?.open) dialog.current.close();
    };
    mobile.addEventListener("change", closeOnDesktop);
    return () => mobile.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <div className="mobile-navigation">
      <button
        ref={trigger}
        type="button"
        className="mobile-menu-trigger"
        aria-label="Open navigation menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => { dialog.current?.showModal(); setOpen(true); }}
      >
        <Menu size={24} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        id={id}
        className="mobile-navigation-drawer"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setOpen(false);
          if (window.matchMedia("(max-width: 800px)").matches) trigger.current?.focus();
          else document.querySelector<HTMLButtonElement>('.public-app .navigation-rail button[aria-pressed="true"]')?.focus();
        }}
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) {
            event.currentTarget.close();
          }
        }}
        onKeyDown={(event) => {
          // showModal makes the rest of the document inert. Explicit wrapping
          // also keeps keyboard focus inside the menu rather than browser chrome.
          if (event.key !== "Tab") return;
          const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first?.focus();
          }
        }}
      >
        <div className="mobile-drawer-heading">
          <h2 id={`${id}-title`}>Explore EvacuRosa</h2>
          <button type="button" className="mobile-menu-trigger" aria-label="Close navigation menu" autoFocus onClick={() => dialog.current?.close()}>
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <p className="mobile-drawer-description">Santa Rosa, Laguna</p>
        <nav aria-label="Mobile map views">
          {sections.map(({ id: section, label, icon: Icon }) => (
            <button
              key={section}
              type="button"
              aria-current={activeSection === section ? "page" : undefined}
              onClick={() => { onSelect(section); dialog.current?.close(); }}
            >
              <Icon size={21} aria-hidden="true" />
              <span>{label}</span>
              {activeSection === section && <Check size={18} aria-hidden="true" />}
            </button>
          ))}
        </nav>
      </dialog>
    </div>
  );
}
