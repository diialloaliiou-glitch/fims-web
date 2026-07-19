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
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-100">Paramètres</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 transition-colors hover:border-emerald-400 hover:bg-slate-800"
          >
            <p className="font-medium text-slate-100">{c.label}</p>
            <p className="mt-1 text-sm text-slate-400">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
