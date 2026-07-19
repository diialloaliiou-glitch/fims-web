"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { JournalEntry } from "@/lib/types";

export default function DashboardPage() {
  const { project } = useAuth();
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [lastEntry, setLastEntry] = useState<{
    n_ecriture_journal: string | null;
    date_operation: string;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<JournalEntry[] | null>(null);
  const [searching, setSearching] = useState(false);

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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !search.trim()) return;

    setSearching(true);
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("project_id", project.id)
      .or(`n_ecriture_journal.ilike.%${search}%,n_piece.ilike.%${search}%`)
      .order("date_operation", { ascending: false })
      .limit(20);

    setSearchResults((data as JournalEntry[]) ?? []);
    setSearching(false);
  }

  const shortcuts = [
    { href: "/saisie", label: "Saisie", desc: "Ajouter une écriture", accent: true },
    { href: "/grand-livre", label: "Grand Livre", desc: "Consultation par compte" },
    { href: "/journal-auxiliaire", label: "Journal Auxiliaire", desc: "Consultation par tiers" },
    { href: "/balance", label: "Balance", desc: "Soldes par compte" },
  ];

  return (
    <div>
      <div className="mb-8 flex flex-col items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900/40 px-6 py-10 text-center">
        <span className="text-lg font-bold tracking-wide text-emerald-400">
          FIMS
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">
          [ BIENVENUE ]
        </h1>
        <p className="text-sm text-slate-400">
          {project?.nom_projet}
          {project ? ` (${project.code_projet})` : ""}
        </p>

        <form
          onSubmit={handleSearch}
          className="mt-2 flex w-full max-w-md gap-2"
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une pièce ou une écriture (ex: BQ-0015)"
            className="w-full rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
          />
          <button
            type="submit"
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            Rechercher
          </button>
        </form>

        <div className="flex flex-wrap justify-center gap-4 pt-2">
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-5 py-3">
            <p className="text-xs text-slate-400">Nombre d&apos;écritures</p>
            <p className="text-xl font-bold text-emerald-400">
              {entryCount === null ? "..." : entryCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-5 py-3">
            <p className="text-xs text-slate-400">Dernière opération</p>
            <p className="text-xl font-bold text-emerald-400">
              {lastEntry?.n_ecriture_journal ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {searchResults !== null && (
        <div className="mb-8 overflow-x-auto rounded-xl border border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-800 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">N° Écriture</th>
                <th className="px-3 py-2 text-left">Pièce</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Libellé</th>
                <th className="px-3 py-2 text-right">Débit</th>
                <th className="px-3 py-2 text-right">Crédit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {searching && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                    Recherche...
                  </td>
                </tr>
              )}
              {!searching && searchResults.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                    Aucun résultat pour &quot;{search}&quot;.
                  </td>
                </tr>
              )}
              {searchResults.map((e) => (
                <tr key={e.id} className="text-slate-200">
                  <td className="px-3 py-2">{e.n_ecriture_journal}</td>
                  <td className="px-3 py-2">{e.n_piece}</td>
                  <td className="px-3 py-2">
                    {new Date(e.date_operation).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-3 py-2">{e.libelle}</td>
                  <td className="px-3 py-2 text-right">
                    {e.montant_debit ? e.montant_debit.toLocaleString("fr-FR") : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {e.montant_credit ? e.montant_credit.toLocaleString("fr-FR") : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`rounded-xl border p-5 transition-colors ${
              s.accent
                ? "border-emerald-600 bg-emerald-900/30 hover:bg-emerald-900/50"
                : "border-slate-700 bg-slate-800/60 hover:border-emerald-400 hover:bg-slate-800"
            }`}
          >
            <p className="font-medium text-slate-100">{s.label}</p>
            <p className="mt-1 text-sm text-slate-400">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
