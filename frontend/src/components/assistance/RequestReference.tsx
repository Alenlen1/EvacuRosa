import { useEffect, useState } from "react";
import { Check, Copy, LoaderCircle } from "lucide-react";
import styles from "./AssistanceProvider.module.css";

export function RequestReference({ id }: { id: string }) {
  const [copyState, setCopyState] = useState<
    "idle" | "copying" | "copied" | "failed"
  >("idle");
  useEffect(() => {
    if (copyState !== "copied") return;
    const timer = setTimeout(() => setCopyState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [copyState]);

  async function copyReference() {
    setCopyState("copying");
    try {
      await navigator.clipboard.writeText(id);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className={styles.requestReference}>
      <dt>Request reference</dt>
      <dd>
        <div className={styles.referenceRow}>
          <span className={styles.shortReference} title={id}>
            #{id.slice(0, 8).toUpperCase()}
          </span>
          <button
            type="button"
            className={styles.copyReference}
            aria-label="Copy full request reference"
            disabled={copyState === "copying"}
            onClick={() => void copyReference()}
          >
            {copyState === "copying" ? (
              <LoaderCircle
                size={14}
                className={styles.spinner}
                aria-hidden="true"
              />
            ) : copyState === "copied" ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            {copyState === "copied" ? "Copied" : "Copy"}
          </button>
        </div>
        <span
          role="status"
          className={
            copyState === "failed"
              ? styles.copyFeedback
              : styles.screenReaderOnly
          }
        >
          {copyState === "copied"
            ? "Full request reference copied."
            : copyState === "failed"
              ? "Copy unavailable. Select the full reference below and copy it manually."
              : ""}
        </span>
        {copyState === "failed" && (
          <input
            className={styles.referenceFallback}
            aria-label="Full request reference"
            readOnly
            value={id}
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.currentTarget.select()}
          />
        )}
      </dd>
    </div>
  );
}
