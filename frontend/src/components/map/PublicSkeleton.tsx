"use client";

import { Map } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import styles from "./PublicSkeleton.module.css";

export function PublicSkeleton({
  kind,
  announce = true,
}: {
  kind: "map" | "centers" | "route" | "hazards";
  announce?: boolean;
}) {
  const { t } = useLanguage();
  const label = t(
    kind === "map"
      ? "Loading map…"
      : kind === "centers"
        ? "Loading evacuation centers…"
        : kind === "hazards"
          ? "Loading hazard information…"
          : "Calculating your route…",
  );
  return (
    <div
      className={`${styles.loading}${kind === "map" ? ` ${styles.map}` : ""}`}
      data-public-skeleton={kind}
      role={announce ? "status" : undefined}
      aria-label={announce ? label : undefined}
      aria-hidden={announce ? undefined : true}
    >
      {kind === "map" ? (
        <>
          <div className={styles.mapPreview} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className={styles.mapCaption}>
            <Map size={21} aria-hidden="true" />
            {label}
          </p>
        </>
      ) : (
        <>
          {announce && <p className={styles.caption}>{label}</p>}
          <div aria-hidden="true">
            {kind === "centers" || kind === "hazards" ? (
              Array.from({ length: 3 }, (_, index) => (
                <div className={styles.centerRow} key={index}>
                  <span className={`${styles.bar} ${styles.icon}`} />
                  <div className={styles.copy}>
                    <span className={`${styles.bar} ${styles.name}`} />
                    <span className={`${styles.bar} ${styles.address}`} />
                    <span className={`${styles.bar} ${styles.badge}`} />
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.routeCard}>
                <span className={`${styles.bar} ${styles.name}`} />
                <span className={`${styles.bar} ${styles.address}`} />
                <div className={styles.metrics}>
                  {[0, 1].map((index) => (
                    <div key={index}>
                      <span className={`${styles.bar} ${styles.value}`} />
                      <span className={`${styles.bar} ${styles.metricLabel}`} />
                    </div>
                  ))}
                </div>
                <span className={`${styles.bar} ${styles.badge}`} />
                <span className={`${styles.bar} ${styles.address}`} />
                <span className={`${styles.bar} ${styles.name}`} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
