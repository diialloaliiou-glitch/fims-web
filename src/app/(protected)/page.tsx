"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { project } = useAuth();
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [lastEntry, setLastEntry] = useState<{
    n_ecriture_journal: string | null;
    date_operation: string;
  } | null>(null);

  useEffect(() => {
    if (!project) return;

    supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .then(({ count }) => setEntryCount(count ?? 0));

    supabase
      .from("journal_entries")
      .select("n_ecriture_journal, date_operation")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setLastEntry(data[0]);
      });
  }, [project]);

  const shortcuts = [
    { href: "/saisie", label: "Saisie", desc: "Ajouter une écriture" },
    { href: "/grand-livre", label: "Grand Livre", desc: "Consultation par compte" },
    { href: "/journal-auxiliaire", label: "Journal Auxiliaire", desc: "Consultation par tiers" },
    { href: "/balance", label: "Balance", desc: "Soldes par compte" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-100">
        Bienvenue{project ? ` — ${project.nom_projet}` : ""}
      </h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Nombre d&apos;écritures saisies</p>
          <p className="mt-1 text-3xl font-bold text-emerald-400">
            {entryCount === null ? "..." : entryCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Dernière opération</p>
          <p className="mt-1 text-3xl font-bold text-emerald-400">
            {lastEntry?.n_ecriture_journal ?? "—"}
          </p>
          {lastEntry && (
            <p className="mt-1 text-xs text-slate-500">
              {new Date(lastEntry.date_operation).toLocaleDateString("fr-FR")}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 transition-colors hover:border-emerald-400 hover:bg-slate-800"
          >
            <p className="font-medium text-slate-100">{s.label}</p>
            <p className="mt-1 text-sm text-slate-400">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
