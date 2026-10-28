"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  House,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { SkeletonBlock } from "./Skeleton";
import styles from "./CdrrmoWorkspace.module.css";

const sections = [
  { id: "dashboard-overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "evacuation-centers", label: "Evacuation centers", icon: House },
  { id: "shared-locations", label: "Shared locations", icon: MapPin },
  { id: "hazard-management", label: "Hazard management", icon: TriangleAlert },
] as const;

type SectionId = (typeof sections)[number]["id"];
const SectionContext = createContext<SectionId>("dashboard-overview");

export function useCdrrmoActiveSection() {
  return useContext(SectionContext);
}

function isSectionId(value: string | undefined): value is SectionId {
  return sections.some(({ id }) => id === value);
}

export function CdrrmoSection({
  id,
  children,
}: {
  id: SectionId;
  children: ReactNode;
}) {
  const active = useContext(SectionContext);
  const visible = active === id;
  const [visited, setVisited] = useState(false);
  useEffect(() => {
    if (visible) setVisited(true);
  }, [visible]);
  // Mount on first use, then retain drafts and map state between sections.
  return (
    <div
      className={styles.sectionPanel}
      data-workspace-panel={id}
      hidden={!visible}
    >
      {(visible || visited) && children}
    </div>
  );
}

export function CdrrmoWorkspace({
  children,
  loading = false,
  onSignOut,
}: {
  children: ReactNode;
  loading?: boolean;
  onSignOut?: () => void;
}) {
  const [active, setActive] = useState<SectionId>("dashboard-overview");
  const drawerRef = useRef<HTMLDialogElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const focusSection = useRef(false);
  const publicMapUrl = process.env.NEXT_PUBLIC_PUBLIC_APP_URL;

  useEffect(() => {
    const restoreSection = () => {
      const section = window.location.hash.slice(1);
      setActive(isSectionId(section) ? section : "dashboard-overview");
    };
    restoreSection();
    window.addEventListener("hashchange", restoreSection);
    window.addEventListener("popstate", restoreSection);
    return () => {
      window.removeEventListener("hashchange", restoreSection);
      window.removeEventListener("popstate", restoreSection);
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({ top: 0, left: 0 });
      if (focusSection.current) {
        document.getElementById(active)?.focus({ preventScroll: true });
        focusSection.current = false;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    let previousOverflow: string | null = null;
    const unlockScroll = () => {
      if (previousOverflow !== null) {
        document.body.style.overflow = previousOverflow;
        previousOverflow = null;
      }
    };
    const lockScroll = () => {
      previousOverflow ??= document.body.style.overflow;
      document.body.style.overflow = "hidden";
    };
    const observer = new MutationObserver(() => {
      if (drawer.open) lockScroll();
      else unlockScroll();
    });
    observer.observe(drawer, { attributes: true, attributeFilter: ["open"] });
    const desktop = window.matchMedia("(min-width: 1101px)");
    const closeOnDesktop = () => {
      if (desktop.matches) drawer.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      observer.disconnect();
      desktop.removeEventListener("change", closeOnDesktop);
      drawer.close();
      unlockScroll();
    };
  }, []);

  function sidebar(mobile = false) {
    return (
      <div className={styles.sidebarContent}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brandRow}>
            <Brand />
            {mobile && (
              <button
                className={styles.closeMenu}
                type="button"
                aria-label="Close navigation"
                onClick={() => drawerRef.current?.close()}
                autoFocus
              >
                <X size={21} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <section className={styles.workspaceCard} aria-label="CDRRMO workspace">
          <span className={styles.workspaceEyebrow}>CITY RESPONSE</span>
          <h2>CDRRMO workspace</h2>
          <span className={styles.accessBadge}>
            <ShieldCheck size={15} aria-hidden="true" />
            CDRRMO staff access
          </span>
        </section>

        <div className={styles.navigationGroup}>
          <p className={styles.navigationLabel}>WORKSPACE</p>
          {loading ? (
            <div className={styles.navigationSkeleton} aria-hidden="true">
              {sections.map(({ id }) => (
                <SkeletonBlock key={id} />
              ))}
            </div>
          ) : (
            <nav aria-label="CDRRMO workspace sections">
              {sections.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  aria-current={active === id ? "page" : undefined}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                </a>
              ))}
            </nav>
          )}
        </div>

        {mobile && publicMapUrl && !loading && (
          <a className={styles.mobilePublicMap} href={publicMapUrl}>
            Public map <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        )}
      </div>
    );
  }

  return (
    <SectionContext.Provider value={active}>
      <div
        className={styles.shell}
        onClick={(event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          const link =
            event.target instanceof Element
              ? event.target.closest<HTMLAnchorElement>('a[href^="#"]')
              : null;
          const section = link?.getAttribute("href")?.slice(1);
          if (!isSectionId(section)) return;
          event.preventDefault();
          drawerRef.current?.close();
          if (window.location.hash !== `#${section}`)
            window.history.pushState(null, "", `#${section}`);
          if (active === section) {
            viewportRef.current?.scrollTo({ top: 0, left: 0 });
            document.getElementById(section)?.focus({ preventScroll: true });
          } else {
            focusSection.current = true;
            setActive(section);
          }
        }}
      >
        <a className={styles.skipLink} href={`#${active}`}>
          Skip to workspace
        </a>
        <aside className={styles.sidebar} aria-label="CDRRMO navigation">
          {sidebar()}
        </aside>
        <dialog
          ref={drawerRef}
          id="cdrrmo-navigation"
          className={styles.drawer}
          aria-label="CDRRMO navigation"
          onClick={(event) => {
            if (event.target === event.currentTarget)
              drawerRef.current?.close();
          }}
        >
          {sidebar(true)}
        </dialog>
        <div className={styles.main}>
          <header className={styles.topbar} aria-busy={loading}>
            <div className={styles.topbarIdentity}>
              {loading ? (
                <SkeletonBlock className={styles.menuSkeleton} />
              ) : (
                <button
                  className={styles.menuButton}
                  type="button"
                  aria-label="Open navigation"
                  aria-haspopup="dialog"
                  aria-controls="cdrrmo-navigation"
                  onClick={() => drawerRef.current?.showModal()}
                >
                  <Menu size={22} aria-hidden="true" />
                </button>
              )}
              <div className={styles.title}>
                <span>CDRRMO · SUPERADMIN</span>
                <h1>{sections.find(({ id }) => id === active)?.label}</h1>
              </div>
            </div>
            <div className={styles.topbarActions}>
              <span className={styles.city}>
                <MapPin size={15} aria-hidden="true" />
                Santa Rosa, Laguna
              </span>
              {loading ? (
                <>
                  {publicMapUrl && (
                    <SkeletonBlock className={styles.publicMapSkeleton} />
                  )}
                  <SkeletonBlock className={styles.signOutSkeleton} />
                </>
              ) : (
                <>
                  {publicMapUrl && (
                    <a href={publicMapUrl} className={styles.publicMap}>
                      Public map
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                  )}
                  <button
                    className={styles.signOut}
                    type="button"
                    onClick={onSignOut}
                  >
                    <LogOut size={17} aria-hidden="true" />
                    <span>Sign out</span>
                  </button>
                </>
              )}
            </div>
          </header>
          <div
            id="cdrrmo-main"
            data-workspace-scroll={active !== "dashboard-overview"}
            className={styles.viewport}
            ref={viewportRef}
            role="region"
            aria-label={`${sections.find(({ id }) => id === active)?.label} content`}
            tabIndex={-1}
          >
            {children}
          </div>
        </div>
      </div>
    </SectionContext.Provider>
  );
}
