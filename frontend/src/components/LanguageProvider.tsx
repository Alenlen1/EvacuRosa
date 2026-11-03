"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { translate, type Language } from "@/lib/translations";

const LanguageContext = createContext({
  language: "en" as Language,
  setLanguage: (_: Language) => {},
  t: (text: string, values?: Record<string, string | number>) =>
    translate(text, "en", values),
});
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  useEffect(() => {
    try {
      if (localStorage.getItem("evacurosa-language") === "fil")
        setLanguage("fil");
    } catch {
      /* Storage can be disabled. */
    }
    return () => {
      document.documentElement.lang = "en";
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const change = useCallback((value: Language) => {
    setLanguage(value);
    try {
      localStorage.setItem("evacurosa-language", value);
    } catch {
      /* Keep the in-memory choice. */
    }
  }, []);
  const t = useCallback(
    (text: string, values?: Record<string, string | number>) =>
      translate(text, language, values),
    [language],
  );
  return (
    <LanguageContext.Provider value={{ language, setLanguage: change, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguageToggle({
  expanded = false,
  compact = false,
}: {
  expanded?: boolean;
  compact?: boolean;
}) {
  const { language, setLanguage } = useLanguage();
  if (compact)
    return (
      <button
        type="button"
        className="mobile-language-toggle"
        role="switch"
        aria-label="Filipino language / Wikang Filipino"
        aria-checked={language === "fil"}
        onClick={() => setLanguage(language === "en" ? "fil" : "en")}
      >
        <span className="mobile-language-thumb" aria-hidden="true" />
        <span
          className={`mobile-language-label${language === "en" ? " is-active" : ""}`}
          lang="en"
          aria-hidden="true"
        >
          EN
        </span>
        <span
          className={`mobile-language-label${language === "fil" ? " is-active" : ""}`}
          lang="fil"
          aria-hidden="true"
        >
          FIL
        </span>
      </button>
    );
  if (expanded)
    return (
      <fieldset className="language-options">
        <legend>Language / Wika</legend>
        <div>
          {(
            [
              ["en", "English"],
              ["fil", "Filipino"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              lang={value}
              aria-pressed={language === value}
              onClick={() => setLanguage(value)}
            >
              {label}
              <span aria-hidden="true">{language === value ? "✓" : ""}</span>
            </button>
          ))}
        </div>
      </fieldset>
    );
  return (
    <label className="language-toggle">
      <span className="sr-only">Language / Wika</span>
      <select
        aria-label="Language / Wika"
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        <option value="en">English</option>
        <option value="fil">Filipino</option>
      </select>
    </label>
  );
}
