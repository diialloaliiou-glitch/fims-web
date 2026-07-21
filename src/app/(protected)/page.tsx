"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { ActionCard } from "@/components/ui/ActionCard";
import { StatCard } from "@/components/ui/StatCard";
import { Pill } from "@/components/ui/Pill";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PREFIXE_COMPTE_BANQUE_PROJET } from "@/lib/solde-banque";
import { scopeToProjectSpending } from "@/lib/project-scope";
import type { BudgetLine, JournalEntry } from "@/lib/types";
import {
  Cloud,
  Wallet,
  Search,
  Clock,
  Database,
  PenLine,
  Feather,
  BookOpen,
  Landmark,
  BookCopy,
  Scale,
  BarChart3,
  Settings,
  FileSpreadsheet,
  Percent,
  TrendingUp,
} from "lucide-react";

function formatPrenom(nomUtilisateur: string | undefined) {
  if (!nomUtilisateur) return "";
  const prenom = nomUtilisateur.trim().split(" ")[0];
  return prenom.charAt(0).toUpperCase() + prenom.slice(1).toLowerCase();
}

export default function DashboardPage() {
  const { profile, project } = useAuth();
  const { t } = useLanguage();
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [lastEntry, setLastEntry] = useState<{
    n_ecriture_journal: string | null;
    date_operation: string;
  } | null>(null);
  const [soldeTresorerie, setSoldeTresorerie] = useState<number | null>(null);
  const [entriesThisMonth, setEntriesThisMonth] = useState<number | null>(null);
  const [tauxConsoBudgetaire, setTauxConsoBudgetaire] = useState<number | null>(null);
  const [tauxConsoAvance, setTauxConsoAvance] = useState<number | null>(null);

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

    // Reproduit CalculerSoldeBanqueProjet() : solde des mouvements TRESORERIE
    // sur le compte banque du projet (prefixe "5211") uniquement.
    supabase
      .from("journal_entries")
      .select("compte_debit, compte_credit, montant_debit, montant_credit")
      .eq("project_id", project.id)
      .eq("type_operation", "TRESORERIE")
      .then(({ data }) => {
        if (!data) return;
        let solde = 0;
        data.forEach((e) => {
          if (e.compte_debit?.startsWith(PREFIXE_COMPTE_BANQUE_PROJET)) solde += e.montant_debit;
          if (e.compte_credit?.startsWith(PREFIXE_COMPTE_BANQUE_PROJET)) solde -= e.montant_credit;
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

    // Reproduit la feuille BUD TRACKER : "Taux de conso budgetaire" (B2 =
    // AB209 = depense totale / budget approuve) et "Taux de conso de
    // l'avance recue" (C5 = AC206 = depense totale / cumul des avances
    // recues, compte 458111 credite).
    Promise.all([
      supabase.from("budget_lines").select("total_cost").eq("project_id", project.id).neq("our_line_code", "52B"),
      scopeToProjectSpending(
        supabase.from("journal_entries").select("b_s_line, montant_debit"),
        project
      ),
      scopeToProjectSpending(
        supabase.from("journal_entries").select("montant_credit").eq("compte_credit", "458111"),
        project
      ),
    ]).then(([budgetRes, entriesRes, avanceRes]) => {
      const budgetTotal = ((budgetRes.data as Pick<BudgetLine, "total_cost">[]) ?? []).reduce(
        (s, l) => s + (l.total_cost ?? 0),
        0
      );
      const depenseTotale = (entriesRes.data ?? []).reduce(
        (s: number, e: { b_s_line: string | null; montant_debit: number }) =>
          e.b_s_line && e.b_s_line.toUpperCase() !== "52B" ? s + e.montant_debit : s,
        0
      );
      const cumulAvance = (avanceRes.data ?? []).reduce(
        (s: number, e: { montant_credit: number }) => s + e.montant_credit,
        0
      );

      setTauxConsoBudgetaire(budgetTotal > 0 ? depenseTotale / budgetTotal : null);
      setTauxConsoAvance(cumulAvance > 0 ? depenseTotale / cumulAvance : null);
    });
  }, [project]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    if (!search.trim()) {
      setNotice(t.dashboard.rechercherAlerte);
      setTimeout(() => setNotice(null), 3000);
      return;
    }

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
    setNotice(`${label} : ${t.dashboard.fonctionnaliteAVenir}`);
    setTimeout(() => setNotice(null), 3500);
  }

  const tiles = [
    { key: "saisie", icon: PenLine, label: t.dashboard.tileSaisie, href: "/saisie", color: "teal" as const },
    { key: "paf", icon: Feather, label: t.dashboard.tilePaf, href: "/paf", color: "teal" as const },
    { key: "glivre", icon: BookOpen, label: t.dashboard.tileGLivre, href: "/grand-livre", color: "blue" as const },
    { key: "jdepense", icon: FileSpreadsheet, label: t.dashboard.tileJdepense, href: "/jdepense", color: "blue" as const },
    { key: "erb", icon: Landmark, label: t.dashboard.tileErb, href: "/erb", color: "blue" as const },
    { key: "jaux", icon: BookCopy, label: t.dashboard.tileJAux, href: "/journal-auxiliaire", color: "blue" as const },
    { key: "balance", icon: Scale, label: t.dashboard.tileBalance, href: "/balance", color: "blue" as const },
    { key: "reporting", icon: BarChart3, label: t.dashboard.tileReporting, href: "/reporting", color: "blue" as const },
    { key: "budtracker", icon: TrendingUp, label: t.dashboard.tileBudTracker, href: "/bud-tracker", color: "blue" as const },
    { key: "parametre", icon: Settings, label: t.dashboard.tileParametre, href: "/parametres", color: "muted" as const },
  ];

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-bg-card"
      />

      <div className="relative mb-8 flex flex-col items-center gap-4 px-4 py-8 text-center">
        <div className="flex flex-wrap justify-center gap-3 lg:absolute lg:left-0 lg:top-0 lg:flex-col lg:justify-start">
          <StatCard
            label={t.dashboard.tauxConsoBudgetaire}
            value={
              tauxConsoBudgetaire === null
                ? "..."
                : `${(tauxConsoBudgetaire * 100).toFixed(1)}%`
            }
            valueColor="teal"
            icon={Percent}
          />
          <StatCard
            label={t.dashboard.tauxConsoAvance}
            value={
              tauxConsoAvance === null ? "..." : `${(tauxConsoAvance * 100).toFixed(1)}%`
            }
            valueColor="amber"
            icon={Percent}
          />
        </div>

        <div className="lg:absolute lg:right-0 lg:top-0">
          <StatCard
            label={t.dashboard.soldeDisponible}
            value={
              soldeTresorerie === null
                ? "..."
                : Math.round(soldeTresorerie).toLocaleString("fr-FR")
            }
            valueColor="teal"
            icon={Wallet}
          />
        </div>

        <div className="flex flex-wrap justify-center gap-3 lg:absolute lg:right-0 lg:top-24 lg:flex-col lg:justify-start">
          <StatCard
            label={t.dashboard.derniereOperation}
            value={lastEntry?.n_ecriture_journal ?? "—"}
            valueColor="blue"
          />
          <StatCard
            label={t.dashboard.ecrituresCeMois}
            value={entriesThisMonth === null ? "..." : entriesThisMonth}
            valueColor="amber"
          />
        </div>

        <Cloud className="h-10 w-10 text-accent-teal" strokeWidth={1.5} />
        <p className="font-display text-xl font-bold tracking-wide text-text-primary">
          FIMS
        </p>
        <p className="-mt-3 text-xs text-text-secondary">
          {t.login.sousTitre}
        </p>

        <h1 className="font-display mt-4 text-3xl font-light tracking-tight text-text-primary">
          {t.dashboard.bienvenue} {formatPrenom(profile?.nom_utilisateur)}
        </h1>
        <p className="text-sm text-text-secondary">
          {project?.nom_projet}
          {project ? ` (${project.code_projet})` : ""}
        </p>

        <form onSubmit={handleSearch} className="mt-2 flex w-full max-w-md gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.dashboard.rechercherPlaceholder}
            className="w-full rounded-full border border-border-subtle bg-bg-card px-4 py-2 text-sm text-text-primary outline-none focus:border-accent-teal"
          />
          <button
            type="submit"
            aria-label={t.dashboard.recherche}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-blue-solid text-on-accent-dark hover:opacity-90"
          >
            <Search className="h-4 w-4" strokeWidth={2} />
          </button>
        </form>

        <div className="flex flex-wrap justify-center gap-3 pt-1">
          <Pill icon={Clock} href="/bud-tracker">
            {t.dashboard.voirSuiviBudgetaire}
          </Pill>
          <Pill icon={Database} onClick={() => comingSoon(t.dashboard.accederBaseDeDonnees)}>
            {t.dashboard.accederBaseDeDonnees}
          </Pill>
        </div>

        {notice && (
          <p className="rounded-md bg-bg-card px-4 py-2 text-sm text-accent-amber">
            {notice}
          </p>
        )}
      </div>

      {searchResults !== null && (
        <div className="relative mb-8 overflow-x-auto rounded-xl border border-border-subtle">
          <table className="min-w-full text-sm">
            <MiniTableHeader
              columns={[t.dashboard.colNEcriture, t.dashboard.colPiece, t.common.date, t.common.libelle, t.common.debit, t.common.credit]}
              align={["left", "left", "left", "left", "right", "right"]}
            />
            <tbody className="divide-y divide-border-subtle bg-bg-card/60">
              {searching && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-text-secondary">
                    {t.dashboard.recherche}
                  </td>
                </tr>
              )}
              {!searching && searchResults.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-text-secondary">
                    {t.dashboard.aucunResultatPour} &quot;{search}&quot;.
                  </td>
                </tr>
              )}
              {searchResults.map((e) => (
                <tr key={e.id} className="text-text-primary">
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

      <div className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <ActionCard
            key={tile.key}
            icon={tile.icon}
            color={tile.color}
            label={tile.label}
            href={tile.href}
          />
        ))}
      </div>
    </div>
  );
}
