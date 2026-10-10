"use client";

import { useEffect, useState } from "react";

/** A brief installed-app introduction; never waits for GPS or network requests. */
export function AppLaunch() {
  const [visible, setVisible] = useState(true);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) { setVisible(false); return; }
    setInstalled(true);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setVisible(false), reducedMotion ? 150 : 2000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return <div className="app-launch" data-installed={installed || undefined}>
    <div className="app-launch-content">
      <img className="app-launch-logo" src="/icons/evacurosa-192.png" width={80} height={80} alt="" />
      <p className="app-launch-brand">EVACU<span>ROSA</span></p>
      <p className="app-launch-city">SANTA ROSA, LAGUNA</p>
      <svg className="app-launch-map" viewBox="0 0 280 180" fill="none" aria-hidden="true">
        <g stroke="#e9e3d8" strokeWidth="2" strokeLinecap="round">
          <path d="M15 45h250M15 90h250M15 135h250M55 15v150M110 15v150M170 15v150M225 15v150" />
          <path d="m15 160 85-50 65-5 100-75M20 20l85 50 80 5 75 85" />
        </g>
        <path d="M55 135h55V90h60V45h55" stroke="#f4e9b0" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        <path className="app-launch-route" d="M55 135h55V90h60V45h55" pathLength="1" stroke="#b99521" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="55" cy="135" r="11" fill="#2563eb" fillOpacity=".2" />
        <circle cx="55" cy="135" r="7" fill="#2563eb" stroke="white" strokeWidth="2" />
        <g className="app-launch-shelter">
          <g transform="translate(199.8 19.8) scale(1.2)">
            <circle cx="21" cy="23" r="18" fill="#17232f" fillOpacity=".15" />
            <circle cx="21" cy="21" r="18" fill="white" stroke="#3B6D11" strokeWidth="2" />
            <circle cx="21" cy="21" r="14.5" fill="#3B6D11" fillOpacity=".1" />
            <g stroke="#344454" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m10 19 11-9 11 9M13 18v13h16V18" fill="white" />
              <path d="M18 31v-8h6v8M16 20h1m8 0h1" />
            </g>
            <circle cx="34" cy="33" r="9" fill="#3B6D11" stroke="white" strokeWidth="2" />
            <path transform="translate(27 26) scale(.58)" d="m7 12 3 3 7-7" stroke="white" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      </svg>
      <p className="app-launch-tagline">Safe routes. Safe shelters.<br /><strong>A safer Santa Rosa.</strong></p>
      <p className="app-launch-status" role="status">Opening EvacuRosa…</p>
    </div>
  </div>;
}
