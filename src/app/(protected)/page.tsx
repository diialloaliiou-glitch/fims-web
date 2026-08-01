"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { ActionCard } from "@/components/ui/ActionCard";
import { StatCard } from "@/components/ui/StatCard";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { scopeToProjectSpending } from "@/lib/project-scope";
import { chargerComptesEffectifs } from "@/lib/comptes-projet";
import { niveauTaux } from "@/lib/taux-couleur";
import { hasRole } from "@/lib/roles";
import type { BudgetLine, JournalEntry } from "@/lib/types";
import Link from "next/link";
import {
  Cloud,
  Wallet,
  Search,
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
  Globe2,
} from "lucide-react";

function formatPrenom(nomUtilisateur: string | undefined) {
  if (!nomUtilisateur) return "";
  const prenom = nomUtilisateur.trim().split(" ")[0];
  return prenom.charAt(0).toUpperCase() + prenom.slice(1).toLowerCase();
}

export default function DashboardPage() {
  const { profile, project } = useAuth();
  const { t } = useLanguage();
  const [lastEntry, setLastEntry] = useState<{
    n_ecriture_journal: string | null;
    date_operation: string;
  } | null>(null);
  const [soldeTresorerie, setSoldeTresorerie] = useState<number | null>(null);
  const [soldeParCompte, setSoldeParCompte] = useState<{ compte: string; libelle: string; solde: number }[]>([]);
  const [entriesThisMonth, setEntriesThisMonth] = useState<number | null>(null);
  const [tauxConsoBudgetaire, setTauxConsoBudgetaire] = useState<number | null>(null);
  const [tauxConsoAvance, setTauxConsoAvance] = useState<number | null>(null);
  // Distingue "pas encore charge" (affiche "...") de "charge mais aucune
  // valeur significative" (ex: aucune avance recue - affiche "-", pas "..."
  // qui donnerait l'impression que ca charge indefiniment).
  const [tauxLoaded, setTauxLoaded] = useState(false);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<JournalEntry[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setTauxLoaded(false);

    supabase
      .from("journal_entries")
      .select("n_ecriture_journal, date_operation")
      .eq("project_id", project.id)
      // Tri par date_operation (date reelle de l'operation), pas created_at
      // (horodatage d'insertion) - un import en masse insere des centaines
      // de lignes historiques au meme instant technique, ce qui rendait
      // "created_at" inutilisable pour trouver la vraie derniere operation.
      .order("date_operation", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setLastEntry(data[0]);
      });

    // Solde disponible = tresorerie totale du projet, tous comptes
    // banque/caisse confondus (521100, 522xxx regionaux, caisse 571000...),
    // pas un seul compte fige - les comptes de transit inter-banques
    // (585000) s'annulent naturellement puisque chaque virement y debite
    // et credite en paire.
    supabase
      .from("journal_entries")
      .select("compte_debit, compte_credit, montant_debit, montant_credit")
      .eq("project_id", project.id)
      .eq("type_operation", "TRESORERIE")
      .then(async ({ data }) => {
        if (!data) return;
        let solde = 0;
        const parCompte = new Map<string, number>();
        data.forEach((e) => {
          if (e.compte_debit?.startsWith("5")) {
            solde += e.montant_debit;
            parCompte.set(e.compte_debit, (parCompte.get(e.compte_debit) ?? 0) + e.montant_debit);
          }
          if (e.compte_credit?.startsWith("5")) {
            solde -= e.montant_credit;
            parCompte.set(e.compte_credit, (parCompte.get(e.compte_credit) ?? 0) - e.montant_credit);
          }
        });
        setSoldeTresorerie(solde);

        const codes = Array.from(parCompte.keys());
        const comptes = await chargerComptesEffectifs(project);
        const libelleParCode = new Map(comptes.map((c) => [c.ccompte, c.libelle]));
        setSoldeParCompte(
          codes
            .sort()
            .map((compte) => ({
              compte,
              libelle: libelleParCode.get(compte) ?? "",
              solde: parCompte.get(compte) ?? 0,
            }))
        );
      });

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    // Une "ecriture" = un N°E-J (une ou plusieurs lignes debit contre une ou
    // plusieurs lignes credit), pas une ligne journal_entries individuelle -
    // compter les lignes brutes surestime largement le nombre d'ecritures.
    supabase
      .from("journal_entries")
      .select("n_ecriture_journal")
      .eq("project_id", project.id)
      .gte("date_operation", firstOfMonth.toISOString().slice(0, 10))
      .then(({ data }) => {
        const distinctes = new Set(
          (data ?? [])
            .map((e) => e.n_ecriture_journal)
            .filter((nej): nej is string => !!nej)
        );
        setEntriesThisMonth(distinctes.size);
      });

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
      const entries =
        (entriesRes.data as { b_s_line: string | null; montant_debit: number }[]) ?? [];
      const depenseTotale = entries.reduce(
        (s, e) => (e.b_s_line && e.b_s_line.toUpperCase() !== "52B" ? s + e.montant_debit : s),
        0
      );
      const cumulAvance = (avanceRes.data ?? []).reduce(
        (s: number, e: { montant_credit: number }) => s + e.montant_credit,
        0
      );

      setTauxConsoBudgetaire(budgetTotal > 0 ? depenseTotale / budgetTotal : null);
      setTauxConsoAvance(cumulAvance > 0 ? depenseTotale / cumulAvance : null);
      setTauxLoaded(true);
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

  // La Saisie est reservee au COMPTABLE (+ ADMIN_N1 pour l'administration
  // du systeme) - ni RAF ni ADMIN_SITE ne doivent la voir, contrairement a
  // la hierarchie de roles habituelle ou ils heritent des droits COMPTABLE.
  const peutSaisir = profile?.role === "ADMIN_N1" || profile?.role === "COMPTABLE";
  const peutVoirKpi = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"]);

  const tilesPrincipales = [
    ...(peutSaisir
      ? [{ key: "saisie", icon: PenLine, label: t.dashboard.tileSaisie, href: "/saisie", color: "teal" as const }]
      : []),
    { key: "paf", icon: Feather, label: t.dashboard.tilePaf, href: "/fiche-paiement", color: "teal" as const },
    { key: "jdepense", icon: FileSpreadsheet, label: t.dashboard.tileJdepense, href: "/jdepense", color: "blue" as const },
    { key: "budtracker", icon: TrendingUp, label: t.dashboard.tileBudTracker, href: "/bud-tracker", color: "blue" as const },
    ...(peutVoirKpi
      ? [{ key: "kpiOrganisationnel", icon: Globe2, label: t.dashboard.tileKpiOrganisationnel, href: "/kpi-organisationnel", color: "teal" as const }]
      : []),
    { key: "reporting", icon: BarChart3, label: t.dashboard.tileReporting, href: "/reporting", color: "blue" as const },
    { key: "glivre", icon: BookOpen, label: t.dashboard.tileGLivre, href: "/grand-livre", color: "blue" as const },
    { key: "balance", icon: Scale, label: t.dashboard.tileBalance, href: "/balance", color: "blue" as const },
  ];

  const tilesSecondaires = [
    { key: "erb", icon: Landmark, label: t.dashboard.tileErb, href: "/erb" },
    { key: "jaux", icon: BookCopy, label: t.dashboard.tileJAux, href: "/journal-auxiliaire" },
    { key: "parametre", icon: Settings, label: t.dashboard.tileParametre, href: "/parametres" },
  ];

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-bg-card"
      />

      <div className="relative mb-8 flex flex-col items-center gap-4 px-4 py-8 text-center">
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

        <form onSubmit={handleSearch} className="mt-2 flex w-full max-w-3xl gap-2">
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

        {notice && (
          <p className="rounded-md bg-bg-card px-4 py-2 text-sm text-accent-amber">
            {notice}
          </p>
        )}
      </div>

      <div className="relative mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div>
          <StatCard
            size="lg"
            label={t.dashboard.soldeDisponible}
            value={
              soldeTresorerie === null
                ? "..."
                : Math.round(soldeTresorerie).toLocaleString("fr-FR")
            }
            valueColor="teal"
            icon={Wallet}
          />
          {soldeParCompte.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {soldeParCompte.map((s) => (
                <div
                  key={s.compte}
                  className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-card-muted px-2.5 py-1.5"
                >
                  <Landmark className="h-3.5 w-3.5 shrink-0 text-text-secondary" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <p className="truncate text-[10px] leading-tight text-text-secondary">
                      {s.compte}
                      {s.libelle ? ` — ${s.libelle}` : ""}
                    </p>
                    <p className="text-xs font-semibold leading-tight text-text-primary">
                      {Math.round(s.solde).toLocaleString("fr-FR")} FCFA
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 content-start">
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
          <StatCard
            label={t.dashboard.tauxConsoBudgetaire}
            value={
              !tauxLoaded
                ? "..."
                : tauxConsoBudgetaire === null
                  ? "—"
                  : `${(tauxConsoBudgetaire * 100).toFixed(1)}%`
            }
            valueColor={tauxConsoBudgetaire === null ? "teal" : niveauTaux(tauxConsoBudgetaire)}
            icon={Percent}
          />
          <StatCard
            label={t.dashboard.tauxConsoAvance}
            value={
              !tauxLoaded
                ? "..."
                : tauxConsoAvance === null
                  ? "—"
                  : `${(tauxConsoAvance * 100).toFixed(1)}%`
            }
            valueColor={tauxConsoAvance === null ? "teal" : niveauTaux(tauxConsoAvance)}
            icon={Percent}
          />
        </div>
      </div>

      {searchResults !== null && (
        <div className="relative mb-8 max-h-[65vh] overflow-auto rounded-xl border border-border-subtle print:max-h-none print:overflow-visible">
          <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
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

      <div className="relative grid grid-cols-2 gap-5 lg:grid-cols-4">
        {tilesPrincipales.map((tile) => (
          <ActionCard
            key={tile.key}
            icon={tile.icon}
            color={tile.color}
            label={tile.label}
            href={tile.href}
          />
        ))}
        <div className="flex min-h-[160px] flex-col justify-center gap-1.5 rounded-2xl border border-border-subtle bg-bg-card-muted p-4">
          {tilesSecondaires.map((tile) => (
            <Link
              key={tile.key}
              href={tile.href}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-card hover:text-accent-teal"
            >
              <tile.icon className="h-4 w-4" strokeWidth={1.75} />
              <span>{tile.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
