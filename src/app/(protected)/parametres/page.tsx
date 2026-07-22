"use client";

import { BookText, Users, UserSquare2, UserCog, FolderKanban, Info, KeyRound, Table2 } from "lucide-react";
import { ActionCard } from "@/components/ui/ActionCard";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { hasRole } from "@/lib/roles";

export default function ParametresPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const cards = [
    { href: "/parametres/plan-comptable", label: t.parametres.tilePlanComptable, icon: BookText, color: "teal" as const },
    { href: "/parametres/budget", label: t.parametres.tileBudget, icon: Table2, color: "blue" as const },
    { href: "/parametres/tiers", label: t.parametres.tileTiers, icon: Users, color: "blue" as const },
    { href: "/parametres/personnel", label: t.parametres.tilePersonnel, icon: UserSquare2, color: "muted" as const },
    ...(hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"])
      ? [{ href: "/parametres/projet", label: t.parametres.tileInfoProjet, icon: Info, color: "teal" as const }]
      : []),
    ...(hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE"])
      ? [{ href: "/administration/utilisateurs", label: t.parametres.tileUtilisateurs, icon: UserCog, color: "teal" as const }]
      : []),
    ...(hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"])
      ? [{ href: "/administration/projets", label: t.parametres.tileProjets, icon: FolderKanban, color: "blue" as const }]
      : []),
    ...(hasRole(profile?.role, ["ADMIN_N1"])
      ? [{ href: "/administration/licences", label: t.parametres.tileLicences, icon: KeyRound, color: "muted" as const }]
      : []),
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">{t.parametres.titre}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <ActionCard key={c.href} icon={c.icon} color={c.color} label={c.label} href={c.href} />
        ))}
      </div>
    </div>
  );
}
