"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { compassHeading, headingDelta, normalizeHeading } from "@/lib/navigation";

export function useNavigationHeading(active: boolean) {
  const [permission, setPermission] = useState<"idle" | "granted" | "unavailable">("idle");
  const [reading, setReading] = useState<{ heading: number; at: number } | null>(null);
  const filter = useRef<{ heading: number; at: number } | null>(null);
  // Called directly from a user gesture, including on iOS.
  const request = useCallback(async () => {
    const sensor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: (absolute?: boolean) => Promise<string> };
    if (!window.isSecureContext || !sensor) { setPermission("unavailable"); return; }
    try { setPermission(!sensor.requestPermission || await sensor.requestPermission(true) === "granted" ? "granted" : "unavailable"); }
    catch { setPermission("unavailable"); }
  }, []);
  useEffect(() => {
    if (!active || permission !== "granted") { setReading(null); filter.current = null; return; }
    const listener = (event: DeviceOrientationEvent) => {
      const value = compassHeading(event, window.screen.orientation?.angle ?? (typeof window.orientation === "number" ? window.orientation : 0));
      const now = Date.now();
      if (value === null || (filter.current && now - filter.current.at < 100)) return;
      const heading = filter.current ? normalizeHeading(filter.current.heading + headingDelta(filter.current.heading, value) * .25) : value;
      filter.current = { heading, at: now }; setReading(filter.current);
    };
    window.addEventListener("deviceorientationabsolute", listener);
    window.addEventListener("deviceorientation", listener);
    return () => { window.removeEventListener("deviceorientationabsolute", listener); window.removeEventListener("deviceorientation", listener); filter.current = null; };
  }, [active, permission]);
  return { reading, permission, request };
}
