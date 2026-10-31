"use client";

import { useId, useRef } from "react";
import { ArrowRight, Building2, CircleCheck, Search, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { EvacuationCenter } from "@/services/api";
import styles from "./CenterDirectory.module.css";

function searchable(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function CenterDirectory({
  centers,
  query,
  onQueryChange,
  acceptingOnly,
  onAcceptingOnlyChange,
  onSelect,
  selectedId,
}: {
  centers: EvacuationCenter[];
  query: string;
  onQueryChange: (value: string) => void;
  acceptingOnly: boolean;
  onAcceptingOnlyChange: (value: boolean) => void;
  onSelect: (center: EvacuationCenter) => void;
  selectedId?: string;
}) {
  const { t } = useLanguage();
  const searchId = useId();
  const resultsId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const words = searchable(query).split(" ").filter(Boolean);
  const filteredCenters = centers.filter((center) => {
    if (
      acceptingOnly &&
      center.status !== "AVAILABLE" &&
      center.status !== "NEARLY_FULL"
    )
      return false;
    const text = searchable(
      `${center.name} ${center.address} ${center.barangayName ?? ""}`,
    );
    return words.every((word) => text.includes(word));
  });

  function resetFilters() {
    onQueryChange("");
    onAcceptingOnlyChange(false);
    searchRef.current?.focus();
  }

  return (
    <section
      className={`center-list ${styles.directory}`}
      aria-label={t("Evacuation center directory")}
    >
      <h3>
        {t("Evacuation centers")}
        <span className={styles.count}>{centers.length}</span>
      </h3>
      <p className={styles.introduction}>
        {t("Choose a center to review capacity and location.")}
      </p>
      <label className={styles.searchLabel} htmlFor={searchId}>
        {t("Search evacuation centers")}
      </label>
      <div className={styles.search}>
        <Search size={18} aria-hidden="true" />
        <input
          ref={searchRef}
          id={searchId}
          type="search"
          autoComplete="off"
          placeholder={t("Center name, barangay or address")}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-describedby={resultsId}
        />
        {query && (
          <button
            type="button"
            className={styles.clearSearch}
            onClick={() => {
              onQueryChange("");
              searchRef.current?.focus();
            }}
            aria-label={t("Clear center search")}
          >
            <X size={17} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className={styles.filters}>
        <button
          type="button"
          className={styles.filter}
          aria-pressed={acceptingOnly}
          onClick={() => onAcceptingOnlyChange(!acceptingOnly)}
        >
          <CircleCheck size={16} aria-hidden="true" />
          {t("Accepting evacuees")}
        </button>
        {(query || acceptingOnly) && (
          <button type="button" className={styles.reset} onClick={resetFilters}>
            {t("Reset filters")}
          </button>
        )}
      </div>
      <p id={resultsId} className={styles.results} role="status">
        {t("Showing {count} of {total} centers", {
          count: filteredCenters.length,
          total: centers.length,
        })}
      </p>
      {filteredCenters.length === 0 && (
        <div className={styles.empty}>
          <Building2 size={25} aria-hidden="true" />
          <p>
            {centers.length === 0
              ? t("No evacuation centers loaded.")
              : t("No centers match your search or filters.")}
          </p>
          {centers.length > 0 && (
            <button type="button" onClick={resetFilters}>
              {t("Show all centers")}
            </button>
          )}
        </div>
      )}
      <div className={styles.rows}>
        {filteredCenters.map((center) => (
          <button
            type="button"
            className={`center-list-item ${styles.row}`}
            key={center.id}
            data-center-id={center.id}
            onClick={() => onSelect(center)}
            aria-pressed={selectedId === center.id}
          >
            <Building2 size={23} aria-hidden="true" />
            <span className={styles.copy}>
              <strong>{center.name}</strong>
              <small className={styles.address}>{center.address}</small>
              <span className={styles.metadata}>
                <StatusBadge status={center.status} />
                <small>
                  {center.currentOccupancy} / {center.capacity} {t("occupied")}
                </small>
              </span>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
