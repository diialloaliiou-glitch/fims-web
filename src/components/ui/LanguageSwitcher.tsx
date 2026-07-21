"use client";

import { useLanguage } from "@/lib/language-context";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center overflow-hidden rounded-full border border-border-subtle text-xs">
      <button
        onClick={() => setLanguage("fr")}
        aria-label="Français"
        className={
          language === "fr"
            ? "bg-accent-blue-solid px-2.5 py-1.5 font-semibold text-on-accent-dark"
            : "px-2.5 py-1.5 text-text-secondary hover:bg-bg-card"
        }
      >
        FR
      </button>
      <button
        onClick={() => setLanguage("en")}
        aria-label="English"
        className={
          language === "en"
            ? "bg-accent-blue-solid px-2.5 py-1.5 font-semibold text-on-accent-dark"
            : "px-2.5 py-1.5 text-text-secondary hover:bg-bg-card"
        }
      >
        EN
      </button>
    </div>
  );
}
