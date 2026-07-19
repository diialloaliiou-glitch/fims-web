"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { JournalEntry } from "@/lib/types";

function icon(path: string) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  saisie: "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z M15 5l4 4",
  paf: "M12 20c-4-1-8-4-8-9a8 8 0 0 1 16 0c0 5-4 8-8 9Z M9 11l2 2 4-4",
  glivre: "M4 5c2-1 5-1 8 0v14c-3-1-6-1-8 0Z M20 5c-2-1-5-1-8 0v14c3-1 6-1 8 0Z",
  erb: "M3 21h18 M4 21V9l8-5 8 5v12 M9 21v-6h6v6",
  jaux: "M4 6h16M4 6v13M20 6v13M4 19h16 M4 12h16 M4 9h16",
  balance: "M12 3v18 M5 7h14 M5 7l-3 6a3 3 0 0 0 6 0Z M19 7l-3 6a3 3 0 0 0 6 0Z",
  reporting: "M4 20V10 M10 20V4 M16 20v-7 M4 20h16",
  parametre:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 13a7.4 7.4 0 0 0 0-2l2-1.5-2-3.5-2.4.8a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.3 2.8a7.6 7.6 0 0 0-1.7 1l-2.4-.8-2 3.5L6.6 11a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-.8a7.6 7.6 0 0 0 1.7 1L11 21h4l.3-2.8a7.6 7.6 0 0 0 1.7-1l2.4.8 2-3.5Z",
  wallet: "M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z M16 12h3 M3 9h18",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M20 20l-4.3-4.3",
  clockbars: "M9 21H3v-4h6Zm6 0h-6V9h6Zm6 0h-6V3h6Z",
  database: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
};

export default function DashboardPage() {
  const { project } = useAuth();
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [lastEntry, setLastEntry] = useState<{
    n_ecriture_journal: string | null;
    date_operation: string;
  } | null>(null);
  const [soldeTresorerie, setSoldeTresorerie] = useState<number | null>(null);
  const [entriesThisMonth, setEntriesThisMonth] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<JournalEntry[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

    supabase
      .from("journal_entries")
      .select("compte_debit, compte_credit, montant_debit, montant_credit")
      .eq("project_id", project.id)
      .then(({ data }) => {
        if (!data) return;
        let solde = 0;
        data.forEach((e) => {
          if (e.compte_debit?.startsWith("5")) solde += e.montant_debit;
          if (e.compte_credit?.startsWith("5")) solde -= e.montant_credit;
        });
        setSoldeTresorerie(solde);
      });

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .gte("date_operation", firstOfMonth.toISOString().slice(0, 10))
      .then(({ count }) => setEntriesThisMonth(count ?? 0));
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

  function comingSoon(label: string) {
    setNotice(`${label} : fonctionnalité à venir dans une prochaine itération.`);
    setTimeout(() => setNotice(null), 3500);
  }

  const tiles = [
    { key: "saisie", label: "Saisie", href: "/saisie", tone: "accent" as const },
    { key: "paf", label: "PAF", href: "/paf", tone: "accent" as const },
    { key: "glivre", label: "G-Livre", href: "/grand-livre", tone: "info" as const },
    { key: "erb", label: "ERB", tone: "info" as const },
    { key: "jaux", label: "J-Auxiliaire", href: "/journal-auxiliaire", tone: "info" as const },
    { key: "balance", label: "Balance", href: "/balance", tone: "info" as const },
    { key: "reporting", label: "Reporting", href: "/reporting", tone: "info" as const },
    { key: "parametre", label: "Paramètre", href: "/parametres", tone: "muted" as const },
  ];

  const toneClasses = {
    accent: "border-emerald-700 bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/60",
    info: "border-slate-700 bg-slate-800/60 text-sky-300 hover:border-emerald-400 hover:bg-slate-800",
    muted: "border-slate-700 bg-slate-800/30 text-slate-500 hover:bg-slate-800/50",
  };

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-slate-800/40"
      />

      <div className="relative mb-8 flex flex-col items-center gap-4 px-4 py-8 text-center">
        <div className="absolute right-0 top-0 flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-left">
            <p className="text-xs text-slate-400">Solde disponible</p>
            <p className="text-lg font-bold text-emerald-400">
              {soldeTresorerie === null
                ? "..."
                : Math.round(soldeTresorerie).toLocaleString("fr-FR")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-left">
            <p className="text-xs text-slate-400">Dernière opération</p>
            <p className="text-lg font-bold text-sky-400">
              {lastEntry?.n_ecriture_journal ?? "—"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-left">
            <p className="text-xs text-slate-400">Écritures ce mois</p>
            <p className="text-lg font-bold text-amber-400">
              {entriesThisMonth === null ? "..." : entriesThisMonth}
            </p>
          </div>
        </div>

        <span className="text-emerald-400">{icon(ICONS.wallet)}</span>
        <p className="text-xl font-bold tracking-wide text-slate-100">FIMS</p>
        <p className="-mt-3 text-xs text-slate-500">
          Financial Information Management System
        </p>

        <h1 className="mt-4 rounded-lg border border-slate-700 px-6 py-2 text-3xl font-bold tracking-tight text-slate-100">
          [ BIENVENUE ]
        </h1>
        <p className="text-sm text-slate-400">
          {project?.nom_projet}
          {project ? ` (${project.code_projet})` : ""}
        </p>

        <form onSubmit={handleSearch} className="mt-2 flex w-full max-w-md gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="BQ-0015"
            className="w-full rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
          />
          <button
            type="submit"
            aria-label="Rechercher"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white hover:bg-sky-500"
          >
            {icon(ICONS.search)}
          </button>
        </form>

        <div className="flex flex-wrap justify-center gap-3 pt-1">
          <Link
            href="/budget"
            className="flex items-center gap-2 rounded-full border border-slate-600 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            <span className="h-4 w-4">{icon(ICONS.clockbars)}</span>
            Voir le suivi budgétaire
          </Link>
          <button
            onClick={() => comingSoon("Accès base de données")}
            className="flex items-center gap-2 rounded-full border border-slate-600 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            <span className="h-4 w-4">{icon(ICONS.database)}</span>
            Accéder à la base de données
          </button>
        </div>

        {notice && (
          <p className="rounded-md bg-slate-800 px-4 py-2 text-sm text-amber-300">
            {notice}
          </p>
        )}
      </div>

      {searchResults !== null && (
        <div className="relative mb-8 overflow-x-auto rounded-xl border border-slate-700">
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

      <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((t) => {
          const content = (
            <>
              <span>{icon(ICONS[t.key as keyof typeof ICONS])}</span>
              <p className="mt-2 font-semibold">{t.label}</p>
            </>
          );
          const className = `flex flex-col items-center justify-center gap-1 rounded-2xl border p-6 text-center transition-colors ${toneClasses[t.tone]}`;

          return t.href ? (
            <Link key={t.key} href={t.href} className={className}>
              {content}
            </Link>
          ) : (
            <button
              key={t.key}
              onClick={() => comingSoon(t.label)}
              className={className}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
