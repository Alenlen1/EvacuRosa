"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-color-scheme: dark)";
function subscribe(onChange: () => void) {
  const preference = window.matchMedia(query);
  preference.addEventListener("change", onChange);
  return () => preference.removeEventListener("change", onChange);
}

/** Follow device appearance, including changes made while the app is open. */
export function useSystemDarkMode() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
