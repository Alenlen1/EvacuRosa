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
import { ArrowRight, HandHeart, LoaderCircle, Send, X } from "lucide-react";
import type { GeolocationState } from "@/hooks/useGeolocation";
import {
  captureAssistanceLocation,
  type AssistanceLocation,
} from "@/lib/assistanceLocation";
import { AssistanceRequestForm } from "./AssistanceRequestForm";
import { AssistanceRequestStatus } from "./AssistanceRequestStatus";
import { AssistanceRequestTabs } from "./AssistanceRequestTabs";
import {
  clearAssistanceView,
  readAssistanceView,
  writeAssistanceView,
  type AssistanceView,
} from "@/lib/assistanceView";
import { CancelAssistanceDialog } from "./CancelAssistanceDialog";
import styles from "./AssistanceProvider.module.css";
import { useLanguage } from "@/components/LanguageProvider";
import {
  assistanceActive,
  acceptAssistance,
  ASSISTANCE_LABELS,
  ASSISTANCE_STORAGE_KEY,
  consumeAssistanceEvents,
  newAssistanceCredentials,
  readAssistance,
  writeAssistance,
  type AssistanceCredentials,
  type AssistanceStatus,
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
import type { AssistanceContext as RequestIntent } from "@/services/api";
const AssistanceContext = createContext<{
  openRequest: (intent?: RequestIntent) => void;
  hasRequest: boolean;
  requestOpen: boolean;
  status: AssistanceStatus | null;
} | null>(null);
export function useAssistance() {
  const value = useContext(AssistanceContext);
  if (!value) throw Error("Assistance provider is missing");
  return value;
}
export function AssistanceRequestShortcut() {
  const { hasRequest, requestOpen, status, openRequest } = useAssistance();
  if (!hasRequest || requestOpen) return null;
  return (
    <button
      type="button"
      className={styles.requestShortcut}
      aria-label="View my assistance request"
      aria-haspopup="dialog"
      aria-controls="assistance-dialog"
      onClick={() => openRequest()}
    >
      <span
        className={styles.shortcutDot}
        data-status={status}
        aria-hidden="true"
      />
      <span className={styles.shortcutCopy}>
        <small>Emergency assistance</small>
        <strong aria-live="polite">
          {status ? ASSISTANCE_LABELS[status] : "Your saved request"}
        </strong>
      </span>
      <span className={styles.shortcutAction}>
        View request
        <ArrowRight size={17} aria-hidden="true" />
      </span>
    </button>
  );
}
export function AssistanceProvider({
  children,
  geolocation,
}: {
  children: ReactNode;
  geolocation?: GeolocationState;
}) {
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
    [operation, setOperation] = useState<
      "locating" | "submitting" | "cancelling" | null
    >(null),
    [error, setError] = useState("");
  const busy = operation !== null;
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState("");
  const locationCapture = useRef<AbortController | null>(null);
  const [fixSource, setFixSource] = useState<"map" | "device" | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [fix, setFix] = useState<AssistanceLocation | null>(null),
    [name, setName] = useState(""),
    [contact, setContact] = useState("");
  const [connection, setConnection] = useState("Reconnecting"),
    [requestView, setRequestView] = useState<AssistanceView>("overview");
  const [viewReady, setViewReady] = useState(false);
  const hasExistingRequest = Boolean(credentials?.trackingToken);
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
      locationCapture.current?.abort();
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
      const view = readAssistanceView(saved.id);
      setRequestView(view?.view ?? "overview");
      setOpen(view?.open ?? !saved.trackingToken);
    }
    setViewReady(true);
    setOnline(navigator.onLine);
  }, []);
  useEffect(() => {
    if (viewReady && credentials?.id)
      writeAssistanceView(credentials.id, open, requestView);
  }, [viewReady, credentials?.id, open, requestView]);
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
        setRequestView("overview");
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
    if (!open || terminal || unavailable || credentials?.id !== cancelTarget) {
      setCancelTarget(null);
      setCancelError("");
    }
  }, [open, terminal, unavailable, credentials?.id, cancelTarget]);
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
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const resize = () => {
      dialog.current?.style.setProperty(
        "--assistance-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      dialog.current?.style.setProperty(
        "--assistance-viewport-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
    };
  }, [open]);
  function openRequest(context?: RequestIntent) {
    setIntent(context ?? { kind: "emergency", travelMode: "walking" });
    setOpen(true);
  }
  async function locate(forceFresh = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setOperation("locating");
    setError("");
    const capture = new AbortController();
    locationCapture.current = capture;
    try {
      if (!navigator.onLine)
        throw Error(
          "You are offline. This request cannot be submitted until connected. Use official emergency communication channels.",
        );
      const result = await captureAssistanceLocation({
        cached: geolocation,
        forceFresh,
        geolocation: navigator.geolocation,
        signal: capture.signal,
      });
      if (!mounted.current || capture.signal.aborted) return;
      setFix(result.fix);
      setFixSource(result.source);
    } catch (cause) {
      if (mounted.current && !capture.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not retrieve location.",
        );
    } finally {
      locationCapture.current = null;
      busyRef.current = false;
      if (mounted.current) setOperation(null);
    }
  }
  async function submit() {
    if (!fix || busyRef.current) return;
    busyRef.current = true;
    setOperation("submitting");
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
      if (mounted.current) setOperation(null);
    }
  }
  async function cancel() {
    const saved = credentialsRef.current;
    if (
      !saved?.trackingToken ||
      saved.id !== cancelTarget ||
      busyRef.current ||
      terminal ||
      unavailable
    )
      return;
    busyRef.current = true;
    setOperation("cancelling");
    setCancelError("");
    try {
      if (!navigator.onLine)
        throw Error(
          "You are offline. Reconnect before cancelling your request.",
        );
      apply(await cancelMyAssistance(saved.id, saved.trackingToken));
      setCancelTarget(null);
    } catch (cause) {
      setCancelError(
        cause instanceof Error
          ? cause.message
          : "Cancellation could not be confirmed.",
      );
    } finally {
      busyRef.current = false;
      if (mounted.current) setOperation(null);
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
    clearAssistanceView();
    setRequestView("overview");
    setError("");
  }
  return (
    <AssistanceContext.Provider
      value={{
        openRequest,
        hasRequest: hasExistingRequest,
        requestOpen: open,
        status: tracking?.request.status ?? null,
      }}
    >
      {children}
      <dialog
        id="assistance-dialog"
        ref={dialog}
        className={`assistance-tracking-dialog ${styles.dialog}`}
        aria-labelledby="assistance-dialog-title"
        data-view={hasExistingRequest ? requestView : "form"}
        onCancel={(e) => {
          if (busy && operation !== "locating") e.preventDefault();
          else locationCapture.current?.abort();
        }}
        onClose={() => {
          locationCapture.current?.abort();
          setOpen(false);
          requestAnimationFrame(() => {
            if (previousFocus.current?.isConnected)
              previousFocus.current.focus();
            else
              document
                .querySelector<HTMLButtonElement>(
                  '[aria-controls="assistance-dialog"]',
                )
                ?.focus();
          });
        }}
      >
        <header>
          <div className={styles.dialogIdentity}>
            <span className={styles.headerIcon}>
              <HandHeart size={24} aria-hidden="true" />
            </span>
            <div>
              <small>EVACUROSA · CDRRMO</small>
              <h2 id="assistance-dialog-title">
                {hasExistingRequest
                  ? "View request"
                  : t("Emergency Assistance")}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            disabled={busy && operation !== "locating"}
            aria-label={
              hasExistingRequest ? "Close request" : "Close assistance"
            }
            onClick={() => {
              locationCapture.current?.abort();
              setOpen(false);
            }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        {hasExistingRequest && (
          <AssistanceRequestTabs view={requestView} onChange={setRequestView} />
        )}
        <div
          className={`${styles.body} ${hasExistingRequest && requestView === "location" ? styles.mapBody : ""}`}
        >
          {tracking ? (
            <AssistanceRequestStatus
              tracking={tracking}
              terminal={terminal}
              online={online}
              confirmed={confirmed.current}
              connection={connection}
              unavailable={unavailable}
              view={requestView}
              onRetry={() => setUnavailable(false)}
              onViewChange={setRequestView}
            />
          ) : hasExistingRequest ? (
            <div className={styles.requestLoading} role="status">
              <LoaderCircle
                size={24}
                className={styles.spinner}
                aria-hidden="true"
              />
              <h3>
                {online ? "Loading your request..." : "Your request is saved"}
              </h3>
              <p>
                {online
                  ? "Checking the latest status with CDRRMO."
                  : "Reconnect to view its latest status."}
              </p>
            </div>
          ) : (
            <AssistanceRequestForm
              fix={fix}
              source={fixSource}
              name={name}
              contact={contact}
              locating={operation === "locating"}
              submitting={operation === "submitting"}
              online={online}
              onNameChange={setName}
              onContactChange={setContact}
              onLocate={(forceFresh) => void locate(forceFresh)}
              onStopLocating={() => locationCapture.current?.abort()}
              onSubmit={() => void submit()}
            />
          )}
          {error && (
            <p className={styles.feedback} role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className={styles.footer}>
          {hasExistingRequest ? (
            <>
              <div className={styles.pinnedActions}>
                {requestView !== "overview" && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setRequestView("overview")}
                  >
                    Back to request
                  </button>
                )}
                {tracking &&
                  (!terminal ? (
                    <button
                      type="button"
                      className={styles.cancelRequestButton}
                      disabled={
                        busy ||
                        !online ||
                        unavailable ||
                        !assistanceActive(tracking.request.status)
                      }
                      onClick={() => {
                        setCancelError("");
                        setCancelTarget(tracking.request.id);
                      }}
                    >
                      Cancel request
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={newRequest}
                    >
                      Start a new request
                    </button>
                  ))}
                {!tracking && unavailable && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setUnavailable(false)}
                  >
                    Check status again
                  </button>
                )}
              </div>
              <p>Updates require this page to stay open and connected.</p>
            </>
          ) : (
            <>
              <p id="assistance-consent" className={styles.submitConsent}>
                Confirming sends this location, accuracy, capture time and any
                contact details to CDRRMO. No live tracking. Assistance or
                dispatch is not guaranteed.
              </p>
              <button
                type="submit"
                form="assistance-request-form"
                className={`primary-button ${styles.submitButton}`}
                aria-describedby="assistance-consent"
                disabled={!fix || busy || !online}
              >
                {operation === "submitting" ? (
                  <LoaderCircle
                    size={18}
                    className={styles.spinner}
                    aria-hidden="true"
                  />
                ) : (
                  <Send size={18} aria-hidden="true" />
                )}
                {operation === "submitting"
                  ? "Sending request..."
                  : "Confirm and send request"}
              </button>
              <p>
                If you are in immediate danger, use verified official emergency
                channels.
              </p>
            </>
          )}
        </footer>
      </dialog>
      <CancelAssistanceDialog
        open={cancelTarget !== null}
        busy={operation === "cancelling"}
        error={cancelError}
        onDismiss={() => {
          if (operation !== "cancelling") setCancelTarget(null);
        }}
        onConfirm={() => void cancel()}
      />
    </AssistanceContext.Provider>
  );
}
