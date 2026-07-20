"use client";

import { BookText, Users, UserSquare2, UserCog, FolderKanban, Info } from "lucide-react";
import { ActionCard } from "@/components/ui/ActionCard";
import { useAuth } from "@/lib/auth-context";
import { hasRole } from "@/lib/roles";

export default function ParametresPage() {
  const { profile } = useAuth();

  const cards = [
    { href: "/parametres/plan-comptable", label: "Plan comptable", icon: BookText, color: "teal" as const },
    { href: "/parametres/tiers", label: "Tiers", icon: Users, color: "blue" as const },
    { href: "/parametres/personnel", label: "Fiche Personnel", icon: UserSquare2, color: "muted" as const },
    ...(hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"])
      ? [{ href: "/parametres/projet", label: "Info Projet", icon: Info, color: "teal" as const }]
      : []),
    ...(hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE"])
      ? [{ href: "/administration/utilisateurs", label: "Utilisateurs", icon: UserCog, color: "teal" as const }]
      : []),
    ...(hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"])
      ? [{ href: "/administration/projets", label: "Projets", icon: FolderKanban, color: "blue" as const }]
      : []),
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">Paramètres</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <ActionCard key={c.href} icon={c.icon} color={c.color} label={c.label} href={c.href} />
        ))}
      </div>
    </div>
  );
}
