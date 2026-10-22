"use client";

import { useEffect, type RefObject } from "react";

/** Follow the visible area when a keyboard overlays the layout viewport. */
export function useLoginViewport(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const viewport = window.visualViewport;
    let baselineHeight = Math.max(window.innerHeight, viewport?.height ?? 0);
    let previousWidth = window.innerWidth;
    let compact = false;
    let frame = 0;

    function revealFocusedControl() {
      const panel = root!.querySelector<HTMLElement>(".login-panel");
      const active = document.activeElement;
      if (
        !panel ||
        panel.scrollHeight <= panel.clientHeight + 1 ||
        !(active instanceof HTMLElement) ||
        !panel.contains(active) ||
        !active.matches("input, #login-error")
      )
        return;
      const bounds = panel.getBoundingClientRect();
      const button = panel
        .querySelector<HTMLElement>(".login-submit")
        ?.getBoundingClientRect();
      const top = bounds.top + 8;
      const bottom = Math.min(
        bounds.bottom - 8,
        button ? button.top - 8 : Infinity,
      );
      const field = active.closest(".login-field")?.getBoundingClientRect();
      // Keep the label and validation message with the input when they fit.
      const target =
        field && field.height <= bottom - top
          ? field
          : active.getBoundingClientRect();
      if (target.top < top || target.height > bottom - top)
        panel.scrollTop += target.top - top;
      else if (target.bottom > bottom)
        panel.scrollTop += target.bottom - bottom;
    }

    function update() {
      frame = 0;
      // Pinch zoom is user-controlled; never interpret it as a keyboard.
      if (viewport && Math.abs(viewport.scale - 1) > 0.05) {
        root!.style.removeProperty("--login-viewport-height");
        root!.style.removeProperty("--login-viewport-top");
        root!.removeAttribute("data-login-viewport");
        compact = false;
        return;
      }
      const height = viewport?.height ?? window.innerHeight;
      if (height <= 0) return;
      if (Math.abs(previousWidth - window.innerWidth) > 1) {
        baselineHeight = Math.max(window.innerHeight, height);
        previousWidth = window.innerWidth;
      }
      baselineHeight = Math.max(baselineHeight, height);
      const active = document.activeElement;
      const editing =
        active instanceof HTMLInputElement && root!.contains(active);
      const touchDevice =
        window.matchMedia("(pointer: coarse)").matches ||
        navigator.maxTouchPoints > 0;
      compact =
        touchDevice &&
        (height <= 560 ||
          ((editing || compact) && baselineHeight - height > 120));
      root!.style.setProperty("--login-viewport-height", `${height}px`);
      root!.style.setProperty(
        "--login-viewport-top",
        `${Math.max(0, viewport?.offsetTop ?? 0)}px`,
      );
      root!.dataset.loginViewport = compact ? "compact" : "full";
      if (compact) revealFocusedControl();
    }

    function scheduleUpdate() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    const form = root.querySelector(".login-credentials");
    const observer = new ResizeObserver(scheduleUpdate);
    if (form) observer.observe(form);
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    root.addEventListener("focusin", scheduleUpdate);
    root.addEventListener("focusout", scheduleUpdate);
    update();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      root.removeEventListener("focusin", scheduleUpdate);
      root.removeEventListener("focusout", scheduleUpdate);
      root.style.removeProperty("--login-viewport-height");
      root.style.removeProperty("--login-viewport-top");
      root.removeAttribute("data-login-viewport");
    };
  }, [rootRef]);
}
