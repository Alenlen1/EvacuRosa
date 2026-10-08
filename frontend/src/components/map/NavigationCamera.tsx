"use client";
import { useEffect, useRef, useState } from "react";
import { point } from "leaflet";
import { useMap } from "react-leaflet";
import type { LatLng } from "@/services/api";
import { headingDelta, normalizeHeading } from "@/lib/navigation";

export function NavigationCamera({ active, position, heading, headingUp, fresh, near, lookAhead, recenter, onFollowing }: {
  active: boolean; position: LatLng | null; heading: number | null; headingUp: boolean; fresh: boolean; near: boolean;
  lookAhead: LatLng | null; recenter: number; onFollowing: (following: boolean) => void;
}) {
  const map = useMap();
  const target = useRef({ position, heading, headingUp, fresh, lookAhead, near });
  target.current = { position, heading, headingUp, fresh, lookAhead, near };
  const following = useRef(true);
  const manualZoom = useRef(false);
  const nearApplied = useRef(false);
  const [ready, setReady] = useState(false);
  const oldView = useRef<{ center: ReturnType<typeof map.getCenter>; zoom: number } | null>(null);
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (!active) return;
    oldView.current = { center: map.getCenter(), zoom: map.getZoom() };
    const bounds = map.options.maxBounds;
    // City bounds restrict planning, but must not pin a walking camera against
    // their edge. Restore them when returning to planning.
    map.setMaxBounds([]);
    following.current = true; manualZoom.current = false; nearApplied.current = target.current.near; onFollowing(true);
    map.stop(); map.setZoom(Math.min(nearApplied.current ? 19 : 18, map.getMaxZoom()), { animate: !reduced() }); setReady(true);
    const pause = () => { following.current = false; manualZoom.current = true; map.stop(); onFollowing(false); };
    const gesture = (event: Event) => {
      const element = event.target as HTMLElement;
      if (!element.closest(".leaflet-control") || element.closest(".leaflet-control-zoom")) pause();
    };
    const container = map.getContainer();
    container.addEventListener("pointerdown", gesture);
    container.addEventListener("wheel", gesture, { passive: true });
    container.addEventListener("keydown", gesture);
    map.on("dragstart", pause);
    let frame = 0, last = 0;
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      if (time - last < 32) return;
      const elapsed = Math.min(100, time - last); last = time;
      const current = target.current;
      if (!following.current || !current.fresh || !current.position) return;
      // Exponential damping is independent of sensor update frequency.
      const amount = reduced() ? 1 : 1 - Math.exp(-elapsed / 220);
      const desiredBearing = current.headingUp && current.heading !== null ? -current.heading : 0;
      const delta = headingDelta(map.getBearing(), normalizeHeading(desiredBearing));
      if (Math.abs(delta) > .15) map.setBearing(map.getBearing() + delta * amount);
      const size = map.getSize(), zoom = map.getZoom();
      const user = map.project([current.position.latitude, current.position.longitude], zoom);
      const angle = -map.getBearing() * Math.PI / 180;
      // Put the user at 65% of the visible map height; the top 35% remains
      // available for the route ahead. Rotation-aware world-space offset.
      const card = map.getContainer().querySelector<HTMLElement>(".navigation-card.is-active");
      const usableBottom = card ? Math.max(100, size.y - card.offsetHeight - 42) : size.y;
      const verticalOffset = Math.min(size.y * .65, usableBottom * .72) - size.y / 2;
      const offset = point(-Math.sin(angle) * verticalOffset, Math.cos(angle) * verticalOffset);
      let desired = user.subtract(offset);
      if (current.lookAhead) {
        const ahead = map.project([current.lookAhead.latitude, current.lookAhead.longitude], zoom).subtract(user);
        // A small lateral lead makes bends visible without moving the arrow
        // far from the lower middle or repeatedly changing the zoom.
        const lateral = Math.max(-size.x * .08, Math.min(size.x * .08, (ahead.x * Math.cos(-angle) - ahead.y * Math.sin(-angle)) * .2));
        desired = desired.add(point(lateral * Math.cos(angle), lateral * Math.sin(angle)));
      }
      const center = map.project(map.getCenter(), zoom);
      if (center.distanceTo(desired) > .6) map.panTo(map.unproject(center.add(desired.subtract(center).multiplyBy(amount)), zoom), { animate: false });
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame); setReady(false);
      container.removeEventListener("pointerdown", gesture); container.removeEventListener("wheel", gesture); container.removeEventListener("keydown", gesture); map.off("dragstart", pause);
      map.stop();
      if (bounds) map.setMaxBounds(bounds);
    };
  }, [active, map, onFollowing]);
  useEffect(() => {
    if (active || !oldView.current) return;
    const previous = oldView.current; oldView.current = null;
    const start = performance.now(), initial = map.getBearing();
    let frame = 0;
    const restore = (time: number) => {
      const fraction = reduced() ? 1 : Math.min(1, (time - start) / 500);
      map.setBearing(initial + headingDelta(initial, 0) * (1 - (1 - fraction) ** 3));
      if (fraction < 1) frame = requestAnimationFrame(restore);
    };
    frame = requestAnimationFrame(restore);
    map.flyTo(previous.center, previous.zoom, { duration: reduced() ? 0 : .7 });
    return () => { cancelAnimationFrame(frame); map.stop(); };
  }, [active, map]);
  useEffect(() => {
    if (!active || !ready) return;
    following.current = true; manualZoom.current = false; onFollowing(true);
    nearApplied.current = target.current.near;
    map.stop(); map.setZoom(Math.min(nearApplied.current ? 19 : 18, map.getMaxZoom()), { animate: !reduced() });
  }, [recenter, active, ready, map, onFollowing]);
  useEffect(() => {
    if (!active || !ready || !near || nearApplied.current || manualZoom.current || !following.current) return;
    nearApplied.current = true;
    map.setZoom(Math.min(19, map.getMaxZoom()), { animate: !reduced() });
  }, [active, ready, near, recenter, map]);
  return null;
}
