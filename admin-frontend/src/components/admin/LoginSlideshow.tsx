"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

const slides = [
  {
    src: "/images/login/flood.jpeg",
    label: "Flood preparedness",
    position: "50% 48%",
  },
  {
    src: "/images/login/fire-enhanced.webp",
    label: "Fire response",
    position: "50% 50%",
  },
  {
    src: "/images/login/earthquake.jpg",
    label: "Earthquake readiness",
    position: "48% 50%",
  },
];

export function LoginSlideshow() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPaused(preference.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    updatePreference();
    updateVisibility();
    preference.addEventListener("change", updatePreference);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      preference.removeEventListener("change", updatePreference);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (paused || !visible) return;
    const timer = window.setTimeout(
      () => setActive((current) => (current + 1) % slides.length),
      10000,
    );
    return () => window.clearTimeout(timer);
  }, [active, paused, visible]);

  return (
    <>
      <div className="login-backdrop" aria-hidden="true">
        {slides.map((slide, index) => (
          <img
            key={slide.src}
            src={slide.src}
            alt=""
            className={`login-photo${active === index ? " is-active" : ""}`}
            style={{ objectPosition: slide.position }}
            fetchPriority={index === 0 ? "high" : "low"}
            draggable={false}
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
            onLoad={(event) => {
              event.currentTarget.style.visibility = "visible";
            }}
          />
        ))}
        <div className="login-red-overlay" />
      </div>
      <div
        className="login-slideshow-controls"
        role="group"
        aria-label="Background photos"
      >
        <div className="login-slide-dots">
          {slides.map((slide, index) => (
            <button
              key={slide.src}
              type="button"
              className="login-slide-dot"
              aria-label={`Show photo: ${slide.label}`}
              aria-pressed={active === index}
              onClick={() => setActive(index)}
            >
              <span />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="login-slide-pause"
          onClick={() => setPaused((current) => !current)}
          aria-label={
            paused ? "Play background slideshow" : "Pause background slideshow"
          }
        >
          {paused ? (
            <Play size={13} aria-hidden="true" />
          ) : (
            <Pause size={13} aria-hidden="true" />
          )}
        </button>
        <span className="login-slide-label">{slides[active].label}</span>
      </div>
    </>
  );
}
