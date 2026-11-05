"use client";
import { useEffect, useRef, useState } from "react";
import { DomEvent } from "leaflet";
import { useMap } from "react-leaflet";
import {
  Compass,
  LocateFixed,
  Navigation,
  Square,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  X,
  CircleAlert,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import {
  useEvacuationNavigation,
  type NavigationDestination,
} from "@/hooks/useEvacuationNavigation";
import type { GeolocationState } from "@/hooks/useGeolocation";
import type {
  DestinationApproach,
  LatLng,
  RouteResponse,
} from "@/services/api";
import { estimatedTravelTime, type TravelMode } from "@/lib/travelTime";
import { NavigationCamera } from "./NavigationCamera";
import { NavigationLocation } from "./NavigationLocation";
import { RoutePolyline } from "./RoutePolyline";
import { RouteApproach } from "./RouteApproach";
import { UserLocationMarker } from "./UserLocationMarker";
import { ApproximateNavigationDialog } from "./ApproximateNavigationDialog";

export function EvacuationNavigation({
  route,
  destinationApproach,
  center,
  mode,
  geolocation,
  onRoute,
  onActiveChange,
  onStart,
  onDetails,
  resumeNavigation = false,
  routeUpdating = false,
  onResumeHandled,
  onEnd,
  onRetryLocation,
}: {
  route: LatLng[] | null;
  destinationApproach?: DestinationApproach;
  center?: NavigationDestination;
  mode: TravelMode;
  geolocation: GeolocationState;
  onRoute: (data: RouteResponse) => void;
  onActiveChange: (active: boolean) => void;
  onStart: () => void;
  onDetails?: () => void;
  resumeNavigation?: boolean;
  routeUpdating?: boolean;
  onResumeHandled?: () => void;
  onEnd?: () => void;
  onRetryLocation?: () => void;
}) {
  const { t } = useLanguage();
  const map = useMap();
  const nav = useEvacuationNavigation({
    route,
    center,
    mode,
    geolocation,
    onRoute,
    routeUpdating,
  });
  // Screen rotation lock and compass heading are separate. Keep the map north-up
  // unless the user explicitly chooses to rotate it with their heading.
  const [headingUp, setHeadingUp] = useState(false);
  const [following, setFollowing] = useState(true);
  const [recenter, setRecenter] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [hiddenStartFor, setHiddenStartFor] = useState<string | null>(null);
  const [approximateConfirmation, setApproximateConfirmation] = useState<
    string | null
  >(null);
  const destinationKey = `${center?.id ?? ""}:${center?.latitude}:${center?.longitude}`;
  const confirmationKey = `${destinationKey}:${mode}`;
  const startHidden = hiddenStartFor === destinationKey;
  const wasActive = useRef(false);
  const resumeConsumed = useRef(false);
  useEffect(() => {
    onActiveChange(nav.active);
    if (wasActive.current && !nav.active) onEnd?.();
    wasActive.current = nav.active;
  }, [nav.active, onActiveChange, onEnd]);

  function startNavigation(
    allowPermissionPrompt = true,
    allowApproximate = false,
  ) {
    if (!nav.start(allowPermissionPrompt, allowApproximate)) return false;
    setApproximateConfirmation(null);
    setHiddenStartFor(null);
    setCollapsed(
      window.matchMedia(
        "(max-width: 800px), (max-width: 1100px) and (max-height: 500px)",
      ).matches,
    );
    onStart();
    return true;
  }

  useEffect(() => {
    if (!resumeNavigation) {
      resumeConsumed.current = false;
      return;
    }
    if (resumeConsumed.current || !nav.canStart || nav.active) return;
    resumeConsumed.current = true;
    if (startNavigation(false)) onResumeHandled?.();
  });
  useEffect(() => {
    if (!nav.active) return;
    const container = map.getContainer();
    const sheet = container
      .closest(".public-app")
      ?.querySelector<HTMLElement>(".route-sheet");
    if (!sheet) return;
    // Measure the actual overlap: text wrapping, safe areas, and browser zoom
    // can all make the transport panel taller than its nominal CSS height.
    const update = () => {
      const mapBounds = container.getBoundingClientRect();
      const sheetBounds = sheet.getBoundingClientRect();
      const overlaps =
        sheetBounds.left < mapBounds.right &&
        sheetBounds.right > mapBounds.left;
      const inset = overlaps
        ? Math.max(0, mapBounds.bottom - sheetBounds.top)
        : 0;
      container.style.setProperty("--navigation-panel-inset", `${inset}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(sheet, { box: "border-box" });
    observer.observe(container, { box: "border-box" });
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      container.style.removeProperty("--navigation-panel-inset");
    };
  }, [map, nav.active]);
  const validRoute = !!center && !!route && route.length >= 2;
  const centerUnavailable =
    center?.status === "CLOSED" || center?.status === "FULL";
  const needsLocation = !nav.canStart && !routeUpdating && !centerUnavailable;
  const startHelp = routeUpdating
    ? t("Checking route against updated hazards...")
    : centerUnavailable
      ? t("This center is full or closed. Choose another evacuation center.")
      : geolocation.status === "locating"
        ? t("Getting a fresh GPS location...")
        : geolocation.status === "denied"
          ? t(
              "Allow location access in your browser settings, then refresh your location.",
            )
          : nav.fixIssue === "inaccurate"
            ? t(
                "GPS accuracy is ±{accuracy} m. Refresh for a better reading or review approximate navigation.",
                {
                  accuracy: Math.ceil(geolocation.position!.accuracy),
                },
              )
            : nav.fixIssue === "stale"
              ? t(
                  "Your GPS reading is outdated. Refresh your location to start.",
                )
              : t("Refresh your location to start navigation.");
  return (
    <>
      {approximateConfirmation === confirmationKey && !nav.active && (
        <ApproximateNavigationDialog
          accuracy={geolocation.position?.accuracy ?? null}
          canConfirm={nav.canStart || nav.canStartApproximate}
          blockedReason={startHelp}
          onDismiss={() => setApproximateConfirmation(null)}
          onConfirm={() => startNavigation(true, true)}
          onRefresh={
            onRetryLocation
              ? () => {
                  setApproximateConfirmation(null);
                  onRetryLocation();
                }
              : undefined
          }
        />
      )}
      {nav.active && nav.position ? (
        <NavigationLocation position={nav.position} heading={nav.heading} />
      ) : (
        geolocation.status === "active" &&
        geolocation.position && <UserLocationMarker {...geolocation.position} />
      )}
      {nav.remainingPoints && (
        <RoutePolyline points={nav.remainingPoints} navigating={nav.active}>
          {!nav.arrived && (
            <RouteApproach
              route={route}
              destination={center}
              approach={destinationApproach}
            />
          )}
        </RoutePolyline>
      )}
      <NavigationCamera
        active={nav.active}
        position={nav.position}
        heading={nav.heading}
        headingUp={headingUp}
        fresh={nav.fresh}
        near={nav.near && !nav.offRoute}
        lookAhead={nav.offRoute ? null : nav.lookAhead}
        recenter={recenter}
        onFollowing={setFollowing}
      />
      {(validRoute || nav.active || nav.arrived) && (
        <div
          className="leaflet-bottom leaflet-left navigation-controls"
          ref={(element) => {
            if (element) {
              DomEvent.disableClickPropagation(element);
              DomEvent.disableScrollPropagation(element);
            }
          }}
        >
          <section
            className={`leaflet-control navigation-card${nav.active ? " is-active" : ""}${collapsed ? " is-collapsed" : ""}${!nav.active && !nav.arrived && startHidden ? " is-start-hidden" : ""}`}
            aria-label={t("Evacuation navigation")}
          >
            {nav.arrived ? (
              <div className="arrival-details">
                <p role="status">
                  <CheckCircle size={20} aria-hidden="true" />
                  {t(
                    center?.id
                      ? "You have arrived at the evacuation center."
                      : "You have arrived at your destination.",
                  )}
                </p>
                <strong>{center?.name}</strong>
                {center?.address && <p>{center.address}</p>}
                {center?.entranceInformation?.trim() && (
                  <p>
                    <b>{t("Entrance information")}: </b>
                    {center.entranceInformation}
                  </p>
                )}
                {center?.notes?.trim() && (
                  <details>
                    <summary>{t("Shelter notes")}</summary>
                    <p>{center.notes}</p>
                  </details>
                )}
                <div className="arrival-actions">
                  {onDetails && (
                    <button
                      type="button"
                      onClick={() => {
                        nav.dismissArrival();
                        onDetails();
                      }}
                    >
                      {t("Shelter details")}
                    </button>
                  )}
                  <button type="button" onClick={nav.dismissArrival}>
                    {t("End Navigation")}
                  </button>
                </div>
              </div>
            ) : !nav.active ? (
              <>
                {startHidden && (
                  <button
                    id="navigation-prompt-restore"
                    type="button"
                    className="navigation-start-restore"
                    aria-label={t("Show navigation prompt")}
                    aria-controls="navigation-start-prompt"
                    aria-expanded={false}
                    onClick={() => {
                      setHiddenStartFor(null);
                      requestAnimationFrame(() => {
                        document
                          .querySelector<HTMLButtonElement>(
                            "#navigation-start-prompt button:not(:disabled)",
                          )
                          ?.focus({ preventScroll: true });
                      });
                    }}
                  >
                    <Navigation size={16} aria-hidden="true" />
                    {t("Navigation")}
                    <ChevronUp size={16} aria-hidden="true" />
                  </button>
                )}
                <div
                  id="navigation-start-prompt"
                  className="navigation-start-prompt"
                  hidden={startHidden}
                >
                  <div className="navigation-start-actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!nav.canStart && !nav.canStartApproximate}
                      aria-haspopup={
                        nav.canStartApproximate ? "dialog" : undefined
                      }
                      aria-describedby={
                        !nav.canStart ? "navigation-start-help" : undefined
                      }
                      onClick={() => {
                        if (nav.canStartApproximate)
                          setApproximateConfirmation(confirmationKey);
                        else startNavigation();
                      }}
                    >
                      <Navigation size={18} />
                      {t("Start Navigation")}
                    </button>
                    <button
                      type="button"
                      className="navigation-start-hide"
                      aria-label={t("Hide navigation prompt")}
                      title={t("Hide navigation prompt")}
                      onClick={() => {
                        setHiddenStartFor(destinationKey);
                        requestAnimationFrame(() => {
                          document
                            .getElementById("navigation-prompt-restore")
                            ?.focus({ preventScroll: true });
                        });
                      }}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                  {!nav.canStart && (
                    <small id="navigation-start-help" role="status">
                      {startHelp}
                    </small>
                  )}
                  {needsLocation && onRetryLocation && (
                    <button
                      type="button"
                      className="navigation-refresh-location"
                      onClick={onRetryLocation}
                      disabled={geolocation.status === "locating"}
                    >
                      <LocateFixed size={16} aria-hidden="true" />
                      {t(
                        geolocation.status === "locating"
                          ? "Updating location..."
                          : "Refresh location",
                      )}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                {nav.approximate && (
                  <p className="navigation-approximate-warning" role="status">
                    <CircleAlert size={17} aria-hidden="true" />
                    <span>
                      <strong>
                        {t("Approximate location · ±{accuracy} m", {
                          accuracy: Math.ceil(geolocation.position!.accuracy),
                        })}
                      </strong>
                      {t(
                        "Route progress, automatic rerouting and arrival detection paused.",
                      )}
                    </span>
                  </p>
                )}
                <div className="navigation-quick-actions">
                  <button
                    type="button"
                    className="navigation-recenter"
                    aria-label={t("Recenter Navigation")}
                    title={t("Recenter Navigation")}
                    onClick={() => setRecenter((value) => value + 1)}
                  >
                    <LocateFixed size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="navigation-toggle"
                    aria-label={t(
                      collapsed
                        ? "Show navigation controls"
                        : "Hide navigation controls",
                    )}
                    title={t(
                      collapsed
                        ? "Show navigation controls"
                        : "Hide navigation controls",
                    )}
                    aria-expanded={!collapsed}
                    aria-controls="navigation-details"
                    onClick={() => setCollapsed((value) => !value)}
                  >
                    {collapsed ? (
                      <SlidersHorizontal size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                    <span>
                      {t(
                        collapsed
                          ? "Show navigation controls"
                          : "Hide navigation controls",
                      )}
                    </span>
                  </button>
                </div>
                {collapsed && (
                  <div className="navigation-compact-summary">
                    <strong>
                      {nav.remaining < 1000
                        ? `${Math.round(nav.remaining)} m`
                        : `${(nav.remaining / 1000).toFixed(1)} km`}
                    </strong>
                    <span>{estimatedTravelTime(nav.remaining, mode)}</span>
                  </div>
                )}
                {collapsed &&
                  !nav.approximate &&
                  (!nav.fresh || nav.offRoute) && (
                    <p className="navigation-compact-warning" role="status">
                      {t(
                        !nav.fresh
                          ? "Waiting for a fresh, accurate GPS location."
                          : "You are away from the planned route.",
                      )}
                    </p>
                  )}
                <div
                  className="navigation-details"
                  id="navigation-details"
                  hidden={collapsed}
                >
                  <div className="navigation-progress">
                    <strong>
                      {nav.remaining < 1000
                        ? `${Math.round(nav.remaining)} m`
                        : `${(nav.remaining / 1000).toFixed(1)} km`}
                    </strong>
                    <span>
                      {t("Estimated time")}:{" "}
                      {estimatedTravelTime(nav.remaining, mode)}
                    </span>
                  </div>
                  <small>{center?.name}</small>
                  <p className="navigation-status" role="status">
                    {t(
                      nav.approximate
                        ? "Waiting for better location accuracy."
                        : !nav.fresh
                          ? "Waiting for a fresh, accurate GPS location."
                          : nav.rerouting
                            ? "Updating your route…"
                            : nav.routeError
                              ? "Could not update the route. Follow local guidance; retrying when location updates."
                              : nav.offRoute
                                ? "You are away from the planned route."
                                : !following
                                  ? "Map moved manually. Recenter to follow again."
                                  : nav.near
                                    ? center?.id
                                      ? "Approaching the evacuation center."
                                      : "Approaching your destination."
                                    : nav.bend !== null
                                      ? "Bend ahead — follow the highlighted path."
                                      : "Following your location",
                    )}
                  </p>
                  {nav.heading === null && (
                    <small>
                      {t(
                        "Compass unavailable. North-up until a movement direction is available.",
                      )}
                    </small>
                  )}
                  {nav.headingSource === "movement" && (
                    <small>
                      {t(
                        "Using GPS movement direction; phone compass is unavailable.",
                      )}
                    </small>
                  )}
                  <div className="navigation-buttons">
                    <button
                      type="button"
                      aria-pressed={headingUp}
                      onClick={() => {
                        if (!headingUp) void nav.compass.request();
                        setHeadingUp((value) => !value);
                      }}
                    >
                      <Compass size={17} />
                      {t(headingUp ? "Heading up" : "North up")}
                    </button>
                    <button type="button" onClick={nav.stop}>
                      <Square size={16} />
                      {t("Stop Navigation")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
