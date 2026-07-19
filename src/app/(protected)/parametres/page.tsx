"use client";

import Link from "next/link";

export default function ParametresPage() {
  const cards = [
    {
      href: "/parametres/plan-comptable",
      label: "Plan comptable",
      desc: "Ajouter ou modifier les comptes du projet",
    },
    {
      href: "/parametres/tiers",
      label: "Tiers",
      desc: "Ajouter, modifier ou désactiver les fournisseurs et partenaires",
    },
    {
      href: "/parametres/personnel",
      label: "Fiche Personnel",
      desc: "Gérer les dossiers du personnel et les salaires",
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-fg-primary">Paramètres</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-border-default bg-surface-2 p-5 transition-colors hover:border-accent-green hover:bg-surface-2"
          >
            <p className="font-medium text-fg-primary">{c.label}</p>
            <p className="mt-1 text-sm text-fg-muted">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
