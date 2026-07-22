"use client";

import Link from "next/link";
import { Landmark, BookCopy, Settings } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

const ECRANS = [
  { key: "erb", href: "/erb", icon: Landmark, labelKey: "tileErb" as const },
  { key: "jaux", href: "/journal-auxiliaire", icon: BookCopy, labelKey: "tileJAux" as const },
  { key: "parametre", href: "/parametres", icon: Settings, labelKey: "tileParametre" as const },
];

// Les 3 ecrans regroupes sous une seule case sur le dashboard (moins
// utilises que les ecrans principaux) n'etaient reliables entre eux qu'en
// repassant par le dashboard - ce petit fil d'Ariane permet de naviguer
// directement de l'un a l'autre.
export function NavigationSecondaire({ actuel }: { actuel: "erb" | "jaux" | "parametre" }) {
  const { t } = useLanguage();

  return (
    <div className="mb-4 flex flex-wrap gap-2 print:hidden">
      {ECRANS.filter((e) => e.key !== actuel).map((e) => (
        <Link
          key={e.key}
          href={e.href}
          className="flex items-center gap-1.5 rounded-full border border-border-subtle px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent-teal hover:text-accent-teal"
        >
          <e.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {t.dashboard[e.labelKey]}
        </Link>
      ))}
    </div>
  );
}
