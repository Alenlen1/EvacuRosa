"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { translate, type Language } from "@/lib/translations";

const LanguageContext = createContext({ language: "en" as Language, setLanguage: (_: Language) => {}, t: (text: string, values?: Record<string, string | number>) => translate(text, "en", values) });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  useEffect(() => {
    try { if (localStorage.getItem("evacurosa-language") === "fil") setLanguage("fil"); } catch { /* Storage can be disabled. */ }
    return () => { document.documentElement.lang = "en"; };
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const change = useCallback((value: Language) => {
    setLanguage(value);
    try { localStorage.setItem("evacurosa-language", value); } catch { /* Keep the in-memory choice. */ }
  }, []);
  const t = useCallback((text: string, values?: Record<string, string | number>) => translate(text, language, values), [language]);
  return <LanguageContext.Provider value={{ language, setLanguage: change, t }}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return <label className="language-toggle"><span className="sr-only">Language / Wika</span>
    <select aria-label="Language / Wika" value={language} onChange={event => setLanguage(event.target.value as Language)}>
      <option value="en">English</option><option value="fil">Filipino</option>
    </select>
  </label>;
}
