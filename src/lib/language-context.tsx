"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { fr } from "./i18n/fr";
import { en } from "./i18n/en";

export type Language = "fr" | "en";

const dictionaries = { fr, en };
const LANGUAGE_KEY = "fims_language";

type LanguageState = {
  language: Language;
  setLanguage: (l: Language) => void;
  t: typeof fr;
};

const LanguageContext = createContext<LanguageState>({
  language: "fr",
  setLanguage: () => {},
  t: fr,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fr");

  useEffect(() => {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    if (saved === "fr" || saved === "en") setLanguageState(saved);
  }, []);

  function setLanguage(l: Language) {
    setLanguageState(l);
    window.localStorage.setItem(LANGUAGE_KEY, l);
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: dictionaries[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
