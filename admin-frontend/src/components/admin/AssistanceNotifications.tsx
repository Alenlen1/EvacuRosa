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
import { ArrowRight, Bell, MapPin, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { consumeAssistanceEvents } from "@/lib/assistance";
import { assistanceDisplayName } from "@/lib/assistancePresentation";
import {
  emptyAssistanceNotifications,
  markAssistanceReviewed,
  reconcileAssistanceNotifications,
} from "@/lib/assistanceNotifications";
import {
  assistanceEventsUrl,
  fetchAssistanceRequestPage,
  type AssistanceRequest,
} from "@/services/api";
import styles from "./AssistanceNotifications.module.css";

type RequestPage = Awaited<ReturnType<typeof fetchAssistanceRequestPage>>;
interface Feed {
  page: RequestPage | null;
  loading: boolean;
  error: string;
  connection: string;
  revision: number;
}
interface Notifications {
  feed: Feed;
  unread: AssistanceRequest[];
  toast: AssistanceRequest | null;
  reviewTarget: { id: string; sequence: number } | null;
  refresh: () => void;
  review: (id?: string) => void;
  markReviewed: (id: string) => void;
  applyStatus: (
    request: Pick<
      AssistanceRequest,
      "id" | "status" | "version" | "status_updated_at"
    >,
  ) => void;
  finishReview: (id: string) => void;
  dismissToast: () => void;
}
const Context = createContext<Notifications | null>(null);
export function useAssistanceNotifications() {
  const value = useContext(Context);
  if (!value)
    throw new Error("Assistance notifications require a CDRRMO workspace.");
  return value;
}

export function AssistanceNotificationsProvider({
  enabled = true,
  children,
}: {
  enabled?: boolean;
  children: ReactNode;
}) {
  const [feed, setFeed] = useState<Feed>({
    page: null,
    loading: true,
    error: "",
    connection: "Reconnecting",
    revision: 0,
  });
  const tracker = useRef(emptyAssistanceNotifications());
  const mutation = useRef(0);
  const [unread, setUnread] = useState<AssistanceRequest[]>([]);
  const [toastId, setToastId] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] =
    useState<Notifications["reviewTarget"]>(null);
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);
  const dismissToast = useCallback(() => setToastId(null), []);
  const finishReview = useCallback(
    (id: string) =>
      setReviewTarget((value) => (value?.id === id ? null : value)),
    [],
  );
  const markReviewed = useCallback((id: string) => {
    tracker.current = markAssistanceReviewed(tracker.current, id);
    setUnread(tracker.current.unread);
    setToastId((value) => (value === id ? null : value));
  }, []);
  const review = useCallback((id?: string) => {
    const target = id ?? tracker.current.unread[0]?.id;
    if (!target) return;
    setReviewTarget((value) => ({
      id: target,
      sequence: (value?.sequence ?? 0) + 1,
    }));
    window.location.hash = "shared-locations";
    setToastId(null);
  }, []);
  const applyStatus = useCallback<Notifications["applyStatus"]>((updated) => {
    mutation.current++;
    tracker.current = {
      ...tracker.current,
      unread: tracker.current.unread
        .map((request) =>
          request.id === updated.id ? { ...request, ...updated } : request,
        )
        .filter(
          (request) => !["COMPLETED", "CANCELLED"].includes(request.status),
        ),
    };
    setUnread(tracker.current.unread);
    setFeed((current) => ({
      ...current,
      page: current.page
        ? {
            ...current.page,
            requests: current.page.requests
              .map((request) =>
                request.id === updated.id
                  ? { ...request, ...updated }
                  : request,
              )
              .filter(
                (request) =>
                  !["COMPLETED", "CANCELLED"].includes(request.status),
              ),
          }
        : null,
    }));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false,
      inFlight = false,
      queued = false,
      live = false;
    let lastSuccess = 0,
      backoff = 1000;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let stream: AbortController | undefined;
    const abort = new AbortController();
    const reset = () => {
      tracker.current = emptyAssistanceNotifications();
      setUnread([]);
      setToastId(null);
      setReviewTarget(null);
    };
    reset();
    const connection = (value: string) => {
      if (!stopped) setFeed((current) => ({ ...current, connection: value }));
    };
    const load = async () => {
      if (stopped || !navigator.onLine) return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      const version = mutation.current;
      setFeed((current) => ({ ...current, loading: true }));
      try {
        const { data } = await supabase!.auth.getSession();
        if (stopped) return;
        if (!data.session)
          throw new Error("Sign in again to view shared locations.");
        const page = await fetchAssistanceRequestPage(
          data.session.access_token,
          abort.signal,
        );
        if (stopped) return;
        if (version !== mutation.current) {
          queued = true;
          return;
        }
        const next = reconcileAssistanceNotifications(
          tracker.current,
          page.requests,
        );
        tracker.current = next.state;
        setUnread(next.state.unread);
        if (next.arrivals.length) setToastId(next.arrivals[0].id);
        lastSuccess = Date.now();
        setFeed((current) => ({
          page,
          loading: false,
          error: "",
          connection: live ? "Connected" : current.connection,
          revision: current.revision + 1,
        }));
      } catch (cause) {
        if (!stopped)
          setFeed((current) => ({
            ...current,
            loading: false,
            error:
              cause instanceof Error
                ? cause.message
                : "Could not load shared locations.",
            connection: navigator.onLine ? "Status may be outdated" : "Offline",
          }));
      } finally {
        inFlight = false;
        if (queued && !stopped) {
          queued = false;
          void load();
        }
      }
    };
    const connect = async () => {
      if (stopped || !navigator.onLine || stream) return;
      const ownStream = new AbortController();
      stream = ownStream;
      try {
        const { data } = await supabase!.auth.getSession();
        if (stopped || ownStream.signal.aborted || !data.session) return;
        await consumeAssistanceEvents(
          assistanceEventsUrl(),
          data.session.access_token,
          ownStream.signal,
          () => void load(),
          (value) => {
            live = value;
            connection(value ? "Connected" : "Reconnecting");
            if (value) backoff = 1000;
          },
        );
      } catch {
        /* Polling continues if streaming is unavailable. */
      } finally {
        if (stream === ownStream) stream = undefined;
        live = false;
        if (!stopped) {
          connection(navigator.onLine ? "Reconnecting" : "Offline");
          clearTimeout(reconnect);
          reconnect = setTimeout(() => void connect(), backoff);
          backoff = Math.min(backoff * 2, 30000);
        }
      }
    };
    const restored = () => {
      void load();
      void connect();
    };
    const visible = () => {
      if (document.visibilityState === "visible") restored();
    };
    const offline = () => {
      live = false;
      stream?.abort();
      if (!stopped)
        setFeed((current) => ({
          ...current,
          loading: false,
          connection: "Offline",
          error: current.page
            ? current.error
            : "Reconnect to load shared locations.",
        }));
    };
    refreshRef.current = () => void load();
    const auth = supabase?.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      stopped = true;
      abort.abort();
      stream?.abort();
      reset();
      setFeed({
        page: null,
        loading: false,
        error: "Sign in again to view shared locations.",
        connection: "Disconnected",
        revision: 0,
      });
    });
    if (supabase) restored();
    else
      setFeed((current) => ({
        ...current,
        loading: false,
        error: "Sign-in is unavailable.",
        connection: "Disconnected",
      }));
    if (!navigator.onLine) offline();
    const poll = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        (!live || Date.now() - lastSuccess > 60000)
      )
        void load();
    }, 12000);
    window.addEventListener("online", restored);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      refreshRef.current = () => {};
      abort.abort();
      stream?.abort();
      clearTimeout(reconnect);
      clearInterval(poll);
      auth?.data.subscription.unsubscribe();
      window.removeEventListener("online", restored);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled]);

  // Only the preview disappears. Unreviewed requests retain their badges.
  useEffect(() => {
    if (!toastId) return;
    const timeout = setTimeout(() => setToastId(null), 10000);
    return () => clearTimeout(timeout);
  }, [toastId]);
  const toast = unread.find((request) => request.id === toastId) ?? null;
  return (
    <Context.Provider
      value={{
        feed,
        unread,
        toast,
        reviewTarget,
        refresh,
        review,
        markReviewed,
        applyStatus,
        finishReview,
        dismissToast,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function AssistanceNotificationButton() {
  const { unread, review } = useAssistanceNotifications();
  return (
    <button
      type="button"
      className={styles.bell}
      disabled={!unread.length}
      aria-label={
        unread.length
          ? `${unread.length} new assistance ${unread.length === 1 ? "request" : "requests"}. Review new requests`
          : "No new assistance requests"
      }
      title={unread.length ? "Review new requests" : "No new requests"}
      onClick={() => review()}
    >
      <Bell size={19} aria-hidden="true" />
      {!!unread.length && (
        <span className={styles.count} aria-hidden="true">
          {unread.length}
        </span>
      )}
    </button>
  );
}

export function AssistanceNotificationToast() {
  const { toast, unread, review, dismissToast } = useAssistanceNotifications();
  return (
    <div className={styles.toastRegion} aria-live="polite" aria-atomic="true">
      {toast && (
        <section className={styles.toast} aria-label="New assistance request">
          <div className={styles.toastHeader}>
            <span className={styles.icon}>
              <Bell size={16} aria-hidden="true" />
            </span>
            <span className={styles.eyebrow}>New assistance request</span>
            <button
              type="button"
              className={styles.close}
              aria-label="Dismiss notification"
              onClick={dismissToast}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
          <div className={styles.toastContent}>
            <strong>{assistanceDisplayName(toast)}</strong>
            <p className={styles.location}>
              <MapPin size={14} aria-hidden="true" />
              {toast.location_name
                ? `Near ${toast.location_name.roadName}`
                : "Location ready to review"}
            </p>
          </div>
          <div className={styles.toastFooter}>
            <span>{unread.length} to review</span>
            <button
              type="button"
              className={styles.reviewButton}
              onClick={() => review(toast.id)}
            >
              View request <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
