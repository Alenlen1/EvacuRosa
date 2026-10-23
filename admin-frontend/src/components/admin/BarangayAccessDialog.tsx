"use client";

import { useEffect, useRef, type CSSProperties, type FormEvent } from "react";
import Image from "next/image";
import { CircleAlert, X } from "lucide-react";
import { SecretInput } from "./SecretInput";
import { barangayCardAppearance } from "@/lib/barangayCardAppearance";

type Props = {
  barangay: { id: string; name: string };
  code: string;
  busy: boolean;
  error: string;
  onCodeChange: (code: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export function BarangayAccessDialog({
  barangay,
  code,
  busy,
  error,
  onCodeChange,
  onSubmit,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPointer = useRef(false);
  const appearance = barangayCardAppearance(barangay.name);
  const colors = {
    "--barangay-card-background": appearance.background,
    "--barangay-card-accent": appearance.accent,
  } as CSSProperties;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.querySelector<HTMLButtonElement>(
      '.barangay-access-card[aria-pressed="true"], .barangay-access-trigger',
    );
    const page = document.documentElement;
    const previousOverflow = page.style.overflow;
    page.style.overflow = "hidden";
    const viewport = window.visualViewport;
    let frame = 0;

    function updateViewport() {
      frame = 0;
      // Preserve user-controlled pinch zoom instead of recentering around it.
      if (viewport && Math.abs(viewport.scale - 1) > 0.05) return;
      const height = viewport?.height ?? window.innerHeight;
      const top = Math.max(0, viewport?.offsetTop ?? 0);
      dialog!.style.setProperty("--barangay-dialog-height", `${height}px`);
      dialog!.style.setProperty(
        "--barangay-dialog-center",
        `${top + height / 2}px`,
      );
      dialog!.dataset.compact = height < 480 ? "true" : "false";
      dialog!.dataset.short = height < 340 ? "true" : "false";
      const input = dialog!.querySelector<HTMLInputElement>("#barangay-code");
      const actions = dialog!.querySelector(".barangay-dialog-actions");
      if (input && document.activeElement === input && actions) {
        const bounds = dialog!.getBoundingClientRect();
        const target = input.getBoundingClientRect();
        const top = bounds.top + 12;
        const bottom = Math.min(
          bounds.bottom - 12,
          actions.getBoundingClientRect().top - 8,
        );
        if (target.top < top) dialog!.scrollTop += target.top - top;
        else if (target.bottom > bottom)
          dialog!.scrollTop += target.bottom - bottom;
      }
    }
    function scheduleUpdate() {
      if (!frame) frame = requestAnimationFrame(updateViewport);
    }
    updateViewport();
    dialog.showModal();
    dialog
      .querySelector<HTMLInputElement>("#barangay-code")
      ?.focus({ preventScroll: true });
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    const observer = new ResizeObserver(scheduleUpdate);
    const form = dialog.querySelector("form");
    if (form) observer.observe(form);

    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      observer.disconnect();
      dialog.close();
      page.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!busy && error)
      dialogRef.current
        ?.querySelector<HTMLInputElement>("#barangay-code")
        ?.focus({ preventScroll: true });
  }, [busy, error]);

  function isBackdrop(event: { clientX: number; clientY: number }) {
    const rect = dialogRef.current?.getBoundingClientRect();
    return (
      !!rect &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="barangay-access-dialog"
      style={colors}
      aria-labelledby="barangay-code-title"
      aria-describedby="barangay-code-description"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onPointerDown={(event) => {
        backdropPointer.current =
          event.target === event.currentTarget && isBackdrop(event);
      }}
      onClick={(event) => {
        if (
          !busy &&
          backdropPointer.current &&
          event.target === event.currentTarget &&
          isBackdrop(event)
        )
          onClose();
        backdropPointer.current = false;
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled)",
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) event.preventDefault();
        else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <form
        className="barangay-access-form"
        noValidate
        onSubmit={onSubmit}
        aria-busy={busy}
      >
        <header className="barangay-dialog-header">
          <div>
            <span className="eyebrow">BARANGAY ACCESS</span>
            <h2 id="barangay-code-title">Enter access code</h2>
          </div>
          <button
            type="button"
            className="barangay-dialog-close"
            aria-label="Close access code dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="barangay-dialog-identity">
          <span
            className={`barangay-dialog-monogram${appearance.logoSrc ? " has-logo" : ""}`}
            aria-hidden="true"
          >
            {appearance.logoSrc ? (
              <Image src={appearance.logoSrc} alt="" fill sizes="44px" />
            ) : (
              appearance.initials
            )}
          </span>
          <div>
            <strong className="barangay-dialog-name">{barangay.name}</strong>
            <span>Santa Rosa, Laguna</span>
          </div>
        </div>
        <label htmlFor="barangay-code">Barangay access code</label>
        <SecretInput
          id="barangay-code"
          name="barangayCode"
          secretLabel="code"
          retainInputFocus
          autoFocus
          autoComplete="off"
          required
          minLength={6}
          maxLength={6}
          pattern="[A-Za-z0-9]{6}"
          enterKeyHint="go"
          autoCapitalize="none"
          spellCheck={false}
          disabled={busy}
          value={code}
          placeholder="6-character code"
          aria-invalid={Boolean(error)}
          aria-describedby={`barangay-code-description${error ? " barangay-code-error" : ""}`}
          onChange={(event) => onCodeChange(event.target.value)}
        />
        <p id="barangay-code-description">
          Use the 6-character code issued to this barangay. Letters are
          case-sensitive.
        </p>
        {error && (
          <p
            id="barangay-code-error"
            className="error-message barangay-code-error"
            role="alert"
          >
            <CircleAlert size={15} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
        <div className="barangay-dialog-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Verifying…" : "Open dashboard"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
