"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { useLanguage } from "@/components/LanguageProvider";
import {
  assistanceActive,
  acceptAssistance,
  ASSISTANCE_LABELS,
  ASSISTANCE_MESSAGES,
  ASSISTANCE_STORAGE_KEY,
  consumeAssistanceEvents,
  newAssistanceCredentials,
  readAssistance,
  writeAssistance,
  type AssistanceCredentials,
  type TrackedAssistance,
} from "@/lib/assistance";
import {
  assistanceEventsUrl,
  cancelMyAssistance,
  fetchTrackedAssistance,
  shareAssistanceLocation,
  recoverAssistance,
  AssistanceTrackingError,
} from "@/services/api";
const ReportedLocationMap = dynamic(() => import("./ReportedLocationMap"), {
  ssr: false,
  loading: () => <p>Loading reported location...</p>,
});
import type { AssistanceContext as RequestIntent } from "@/services/api";
const AssistanceContext = createContext<{
  openRequest: (intent?: RequestIntent) => void;
  hasRequest: boolean;
} | null>(null);
export function useAssistance() {
  const value = useContext(AssistanceContext);
  if (!value) throw Error("Assistance provider is missing");
  return value;
}
type Fix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: string;
};
export function AssistanceProvider({ children }: { children: ReactNode }) {
  const [intent, setIntent] = useState<RequestIntent>({
    kind: "emergency",
    travelMode: "walking",
  });
  const { t } = useLanguage();
  const [credentials, setCredentials] = useState<AssistanceCredentials | null>(
    null,
  );
  const credentialsRef = useRef(credentials);
  credentialsRef.current = credentials;
  const [tracking, setTracking] = useState<TrackedAssistance | null>(null);
  const trackingRef = useRef<TrackedAssistance | null>(null);
  const confirmed = useRef(false);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null),
    [name, setName] = useState(""),
    [contact, setContact] = useState("");
  const [connection, setConnection] = useState("Reconnecting"),
    [showMap, setShowMap] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    previousFocus = useRef<HTMLElement | null>(null);
  const busyRef = useRef(false),
    mounted = useRef(true),
    initial = useRef(false);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (initial.current) return;
    initial.current = true;
    const saved = readAssistance();
    if (saved) {
      setCredentials(saved);
      setTracking(saved.cached ?? null);
      trackingRef.current = null;
      setOpen(!saved.cached || assistanceActive(saved.cached.request.status));
    }
    setOnline(navigator.onLine);
  }, []);
  useEffect(() => {
    const yes = () => setOnline(true),
      no = () => {
        setOnline(false);
        setConnection("Offline");
      };
    window.addEventListener("online", yes);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", yes);
      window.removeEventListener("offline", no);
    };
  }, []);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== ASSISTANCE_STORAGE_KEY || busyRef.current) return;
      const saved = readAssistance();
      if (
        saved &&
        (saved.id !== credentialsRef.current?.id ||
          saved.trackingToken !== credentialsRef.current?.trackingToken)
      ) {
        credentialsRef.current = saved;
        setUnavailable(false);
        confirmed.current = false;
        trackingRef.current = null;
        setCredentials(saved);
        setTracking(saved.cached ?? null);
        setFix(null);
        setConnection("Reconnecting");
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  const apply = useCallback((next: TrackedAssistance, token?: string) => {
    if (!mounted.current) return;
    if (credentialsRef.current?.id !== next.request.id) return;
    const accepted = acceptAssistance(trackingRef.current, next);
    if (accepted !== next) return;
    confirmed.current = true;
    trackingRef.current = next;
    setTracking(next);
    setError("");
    const current = credentialsRef.current;
    if (current && current.id === next.request.id) {
      const saved = {
        id: current.id,
        trackingToken: token ?? current.trackingToken,
        cached: next,
      };
      try {
        writeAssistance(saved);
      } catch {
        setError(
          "Tracking is active, but browser storage could not be updated. Keep this page open.",
        );
      }
      credentialsRef.current = saved;
      setCredentials(saved);
    }
  }, []);
  const terminal =
    confirmed.current &&
    !!tracking &&
    !assistanceActive(tracking.request.status);
  useEffect(() => {
    const saved = credentialsRef.current;
    if (!saved?.submissionKey || saved.trackingToken || busy || !online) return;
    let cancelled = false,
      inFlight = false;
    let timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    async function recover() {
      if (cancelled || inFlight) return;
      clearTimeout(timer);
      inFlight = true;
      let found = false;
      try {
        if (document.visibilityState !== "visible") return;
        const result = await recoverAssistance(
          saved!.id,
          saved!.submissionKey!,
          abort.signal,
        );
        if (!cancelled && result) {
          found = true;
          apply(result, result.trackingToken);
        }
      } catch {
        if (!cancelled)
          setError(
            "The previous submission could not be checked. Retry with this form; the same request ID is reused, or use official emergency communication channels.",
          );
      } finally {
        inFlight = false;
        if (!cancelled && !found) timer = setTimeout(recover, 12000);
      }
    }
    const visible = () => {
      if (document.visibilityState === "visible") void recover();
    };
    document.addEventListener("visibilitychange", visible);
    void recover();
    return () => {
      cancelled = true;
      abort.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [credentials?.id, credentials?.trackingToken, busy, online, apply]);
  useEffect(() => {
    const saved = credentialsRef.current;
    if (!saved?.trackingToken || terminal || unavailable) return;
    let stopped = false,
      inFlight = false,
      queued = false,
      live = false,
      lastSuccess = 0;
    let reconnect: ReturnType<typeof setTimeout>,
      backoff = 1000,
      stream: AbortController | null = null;
    const abort = new AbortController();
    async function refresh() {
      if (stopped || !navigator.onLine) return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      try {
        do {
          queued = false;
          const next = await fetchTrackedAssistance(
            saved!.id,
            saved!.trackingToken!,
            abort.signal,
          );
          if (stopped) return;
          lastSuccess = Date.now();
          apply(next);
          if (!live) setConnection("Reconnecting");
        } while (queued && !stopped);
      } catch (cause) {
        if (!stopped) {
          if (cause instanceof AssistanceTrackingError && cause.status === 404)
            setUnavailable(true);
          setConnection(
            navigator.onLine ? "Status May Be Outdated" : "Offline",
          );
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not refresh status.",
          );
        }
      } finally {
        inFlight = false;
      }
    }
    async function connect() {
      if (stopped || !navigator.onLine) return;
      stream?.abort();
      const ownStream = new AbortController();
      stream = ownStream;
      try {
        await consumeAssistanceEvents(
          assistanceEventsUrl(saved!.id),
          saved!.trackingToken!,
          ownStream.signal,
          () => void refresh(),
          (connected) => {
            if (stopped || stream !== ownStream) return;
            live = connected;
            if (connected) {
              backoff = 1000;
              setConnection("Connected");
            } else {
              setConnection("Reconnecting");
              void refresh();
            }
          },
        );
      } catch {
        /* The secure polling loop remains available. */
      }
      if (!stopped && stream === ownStream) {
        live = false;
        setConnection(navigator.onLine ? "Reconnecting" : "Offline");
        reconnect = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30000);
      }
    }
    const visible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        if (!live) {
          clearTimeout(reconnect);
          void connect();
        }
      }
    };
    const restored = () => {
      setConnection("Reconnecting");
      void refresh();
      clearTimeout(reconnect);
      void connect();
    };
    const offline = () => {
      live = false;
      stream?.abort();
      setConnection("Offline");
    };
    window.addEventListener("online", restored);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    const poll = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        (!live || Date.now() - lastSuccess > 60000)
      )
        void refresh();
    }, 12000);
    void refresh();
    void connect();
    return () => {
      stopped = true;
      abort.abort();
      stream?.abort();
      clearTimeout(reconnect);
      clearInterval(poll);
      window.removeEventListener("online", restored);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [
    credentials?.id,
    credentials?.trackingToken,
    terminal,
    unavailable,
    apply,
  ]);
  useEffect(() => {
    if (open && !dialog.current?.open) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    }
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  function openRequest(context?: RequestIntent) {
    setIntent(context ?? { kind: "emergency", travelMode: "walking" });
    setOpen(true);
  }
  async function locate() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (!navigator.onLine)
        throw Error(
          "You are offline. This request cannot be submitted until connected. Use official emergency communication channels.",
        );
      if (!navigator.geolocation)
        throw Error(
          "GPS is unavailable. Use official emergency communication channels and report your location manually.",
        );
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            resolve,
            (e) =>
              reject(
                Error(
                  e.code === 1
                    ? "Location permission was denied. Enable it in browser settings or report your location through official emergency channels."
                    : e.code === 3
                      ? "GPS timed out. Move to an open area and try again, or use official emergency channels."
                      : "GPS is unavailable. Try again or report your location through official emergency channels.",
                ),
              ),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
          ),
      );
      if (!mounted.current) return;
      setFix({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        recordedAt: new Date(position.timestamp).toISOString(),
      });
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not retrieve location.",
        );
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function submit() {
    if (!fix || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (!navigator.onLine)
        throw Error(
          "You are offline. Nothing was submitted. Use official emergency communication channels.",
        );
      if (Date.now() - Date.parse(fix.recordedAt) > 120000)
        throw Error(
          "This GPS reading is over two minutes old. Get a fresh location before submitting.",
        );
      if (!/^[0-9+() .-]{0,40}$/.test(contact.trim()))
        throw Error(
          "Enter a valid contact number using digits and phone punctuation, or leave it blank.",
        );
      let saved = credentialsRef.current;
      const otherTab = readAssistance();
      if (otherTab && otherTab.id !== saved?.id) {
        saved = otherTab;
        credentialsRef.current = otherTab;
        confirmed.current = false;
        trackingRef.current = null;
        setCredentials(otherTab);
        setTracking(otherTab.cached ?? null);
      }
      if (saved?.trackingToken)
        throw Error(
          "You already have an active emergency assistance request. View that request instead.",
        );
      if (!saved?.submissionKey) {
        saved = newAssistanceCredentials();
        try {
          writeAssistance(saved);
        } catch {
          throw Error(
            "Browser storage is unavailable. Allow site storage to submit and recover this request, or use official emergency communication channels.",
          );
        }
        credentialsRef.current = saved;
        setCredentials(saved);
      }
      const result = await shareAssistanceLocation({
        id: saved.id,
        submissionKey: saved.submissionKey!,
        consent: true,
        ...intent,
        start: { latitude: fix.latitude, longitude: fix.longitude },
        accuracy: fix.accuracy,
        recordedAt: fix.recordedAt,
        name: name.trim(),
        contact: contact.trim(),
      });
      apply(result, result.trackingToken);
      setName("");
      setContact("");
      setFix(null);
      setConnection("Reconnecting");
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Submission could not be confirmed. Retry this request or use official emergency communication channels.",
        );
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function cancel() {
    const saved = credentialsRef.current;
    if (!saved?.trackingToken || busyRef.current) return;
    if (
      !window.confirm(
        "Cancel this assistance request? This notifies CDRRMO that you no longer need assistance for this request.",
      )
    )
      return;
    busyRef.current = true;
    setBusy(true);
    try {
      apply(await cancelMyAssistance(saved.id, saved.trackingToken));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Cancellation could not be confirmed.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function newRequest() {
    if (!terminal) return;
    try {
      localStorage.removeItem(ASSISTANCE_STORAGE_KEY);
    } catch {
      setError(
        "Browser storage could not be cleared. Allow site storage before starting a new request.",
      );
      return;
    }
    setIntent({ kind: "emergency", travelMode: intent.travelMode });
    setUnavailable(false);
    setCredentials(null);
    credentialsRef.current = null;
    setTracking(null);
    trackingRef.current = null;
    confirmed.current = false;
    setFix(null);
    setShowMap(false);
    setError("");
  }
  return (
    <AssistanceContext.Provider
      value={{ openRequest, hasRequest: !!credentials?.trackingToken }}
    >
      {children}
      {credentials?.trackingToken && !open && (
        <button
          className="assistance-reopen"
          onClick={() => openRequest()}
          aria-label="View my assistance request"
        >
          <span aria-live="polite">
            {tracking
              ? ASSISTANCE_LABELS[tracking.request.status]
              : "Assistance request"}
          </span>{" "}
          <strong>View request</strong>
        </button>
      )}
      <dialog
        ref={dialog}
        className="assistance-tracking-dialog"
        aria-labelledby="assistance-dialog-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClose={() => {
          setOpen(false);
          previousFocus.current?.focus();
        }}
      >
        <header>
          <div>
            <small>EVACUROSA</small>
            <h2 id="assistance-dialog-title">{t("Emergency Assistance")}</h2>
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            aria-label="Close assistance"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </header>
        {tracking ? (
          <>
            <p>
              <strong>Request ID:</strong>{" "}
              <span className="assistance-reference">
                {tracking.request.id}
              </span>
            </p>
            <h3 aria-live="polite">
              {ASSISTANCE_LABELS[tracking.request.status]}
            </h3>
            <p>
              <strong>Status:</strong>{" "}
              {tracking.request.status === "PENDING"
                ? "Pending"
                : ASSISTANCE_LABELS[tracking.request.status]}
            </p>
            <p role="status">{ASSISTANCE_MESSAGES[tracking.request.status]}</p>
            <p className="assistance-connection">
              {!online ? "Offline" : terminal ? "Status confirmed" : connection}
              {(!online ||
                !confirmed.current ||
                connection === "Status May Be Outdated") &&
                " - Status may be outdated"}
            </p>
            {unavailable && (
              <button
                className="secondary-button"
                onClick={() => setUnavailable(false)}
              >
                Check status again
              </button>
            )}
            <dl className="assistance-tracking-details">
              <div>
                <dt>Submitted</dt>
                <dd>
                  {new Date(tracking.request.created_at).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt>Latest status update</dt>
                <dd>
                  {new Date(
                    tracking.request.status_updated_at ??
                      tracking.request.created_at,
                  ).toLocaleString()}
                </dd>
              </div>
            </dl>
            <h3>Status history</h3>
            <ol className="assistance-timeline">
              {tracking.history.map((item) => (
                <li key={item.version}>
                  <strong>{ASSISTANCE_LABELS[item.new_status]}</strong>
                  <time dateTime={item.changed_at}>
                    {new Date(item.changed_at).toLocaleString()}
                  </time>
                  <small>
                    {item.actor_kind === "CDRRMO"
                      ? "CDRRMO operator"
                      : item.actor_kind === "PUBLIC_USER"
                        ? "Request owner"
                        : "Previous system record"}
                  </small>
                </li>
              ))}
            </ol>
            {!terminal && (
              <p>Further stages are pending confirmation by CDRRMO.</p>
            )}
            <h3>Last reported location</h3>
            <p>
              {tracking.request.latitude.toFixed(6)},{" "}
              {tracking.request.longitude.toFixed(6)}
              <br />
              Reported GPS accuracy: +/-
              {Math.round(tracking.request.accuracy_meters)} m<br />
              Captured{" "}
              {new Date(tracking.request.location_recorded_at).toLocaleString()}
            </p>
            <p>
              This is a one-time GPS submission, not live tracking. If you move,
              contact CDRRMO through official channels.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowMap((v) => !v)}
            >
              {showMap ? "Hide reported location" : "View reported location"}
            </button>
            {showMap && <ReportedLocationMap request={tracking.request} />}
            {!terminal ? (
              <button
                type="button"
                className="secondary-button"
                disabled={busy || !online || unavailable}
                onClick={() => void cancel()}
              >
                {busy ? "Updating..." : "Cancel Request"}
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={newRequest}
              >
                Start a new assistance request
              </button>
            )}
          </>
        ) : (
          <>
            <p>
              Your GPS coordinates, accuracy and capture time will be shared
              with authorized CDRRMO personnel when you confirm submission. This
              does not guarantee assistance or dispatch.
            </p>
            <p>Location is shared once. No live or background tracking.</p>
            <label>
              Name (optional)
              <input
                value={name}
                maxLength={100}
                autoComplete="name"
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Contact number (optional)
              <input
                type="tel"
                value={contact}
                maxLength={40}
                autoComplete="tel"
                disabled={busy}
                onChange={(e) => setContact(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => void locate()}
            >
              {busy
                ? "Please wait..."
                : fix
                  ? "Get a fresh location"
                  : "Share GPS location"}
            </button>
            {fix && (
              <section className="assistance-location-preview">
                <h3>Review your reported location</h3>
                <p>
                  {fix.latitude.toFixed(6)}, {fix.longitude.toFixed(6)}
                  <br />
                  GPS accuracy: +/-{Math.round(fix.accuracy)} m
                </p>
                {fix.accuracy > 100 && (
                  <p role="status">
                    GPS accuracy is poor. Your position may vary within this
                    radius. Try a fresh reading in an open area or explain your
                    exact location to CDRRMO.
                  </p>
                )}
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void submit()}
                >
                  Confirm and Submit Request
                </button>
              </section>
            )}
          </>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <p className="assistance-caption">
          If you are in immediate danger, use verified official emergency
          communication channels. Updates require this PWA to be open and
          connected. Closing it does not provide background updates.
        </p>
      </dialog>
    </AssistanceContext.Provider>
  );
}
