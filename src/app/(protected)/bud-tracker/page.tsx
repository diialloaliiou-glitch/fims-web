"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { scopeToProjectSpending } from "@/lib/project-scope";
import { cumulAvanceRecue } from "@/lib/avance-recue";
import type { BudgetLine, ProjectOutput } from "@/lib/types";

type Mois = { idc: string; label: string };
type Trimestre = { mois: Mois[]; label: string; labelCourt: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Reproduit J4:X4 / J7:X7 de la vraie feuille BUD TRACKER : 12 mois a partir
// de la date de debut du projet, regroupes par trimestre de 3 (avec une
// colonne "Total - Tn" apres chaque groupe). Etendu au-dela de 12 mois si le
// projet dure plus longtemps ou si des ecritures existent apres sa date de
// fin officielle (sinon leur montant disparaitrait des totaux).
function listeTrimestres(debut: string, fin: string): Trimestre[] {
  const mois: Mois[] = [];
  const cursor = new Date(debut);
  const end = new Date(fin);
  cursor.setDate(1);
  end.setDate(1);
  while (cursor <= end) {
    const m = cursor.getMonth() + 1;
    const y = cursor.getFullYear();
    mois.push({
      idc: `${m}_${y}`,
      label: cursor.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const trimestres: Trimestre[] = [];
  for (let i = 0; i < mois.length; i += 3) {
    const groupe = mois.slice(i, i + 3);
    const premier = groupe[0]?.label ?? "";
    const dernier = groupe[groupe.length - 1]?.label ?? "";
    trimestres.push({
      mois: groupe,
      label: `Total - T${trimestres.length + 1}`,
      labelCourt: `T${trimestres.length + 1} · ${premier} – ${dernier}`,
    });
  }
  return trimestres;
}

type LigneCalculee = BudgetLine & {
  parRepartition: number;
  rAvanceAcc: number;
  parMois: Record<string, number>;
  total: number;
  solde: number;
  pctConsoB: number;
  pctConsoA: number;
};

// Seuils visuels du % de consommation (present./ambre/rouge) - purement
// presentation, ne recalcule rien.
function couleurTaux(pct: number) {
  if (pct > 1) return "text-accent-red";
  if (pct >= 0.8) return "text-accent-amber";
  return "text-accent-teal";
}

// Largeurs/decalages fixes pour les colonnes gelees a gauche - necessaires
// pour un positionnement sticky fiable (chaque cellule gelee doit connaitre
// son offset gauche cumule).
const COL_PROJET_W = 96;
const COL_BSLINE_W = 96;
const COL_DESCRIPTION_W = 240;
const COL_BUDGET_W = 130;
const COL_DETAIL_W = 110;
const COL_MOIS_W = 90;
const COL_TOTAL_T_W = 100;
const COL_TOTALCONSO_W = 110;
const COL_SOLDE_W = 110;
const COL_PCT_W = 90;
const COL_DEVISE_W = 130;
const LEFT_PROJET = 0;
const LEFT_BSLINE = COL_PROJET_W;
const LEFT_DESCRIPTION = COL_PROJET_W + COL_BSLINE_W;
const LEFT_BUDGET = COL_PROJET_W + COL_BSLINE_W + COL_DESCRIPTION_W;

const FROZEN_TH = "sticky z-20 bg-bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary border-r border-border-subtle";
const FROZEN_TD = "sticky z-10 bg-bg-card px-3 py-2 text-text-primary border-r border-border-subtle";

export default function BudTrackerPage() {
  const { project } = useAuth();
  const { t } = useLanguage();
  const [lignes, setLignes] = useState<LigneCalculee[]>([]);
  const [trimestres, setTrimestres] = useState<Trimestre[]>([]);
  const [cumulAvance, setCumulAvance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erreurDates, setErreurDates] = useState(false);
  const [outputs, setOutputs] = useState<ProjectOutput[]>([]);
  const [outputFilter, setOutputFilter] = useState<string>("");
  const [detailOuvert, setDetailOuvert] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!project) return;
    supabase
      .from("project_outputs")
      .select("*")
      .eq("project_id", project.id)
      .order("ordre")
      .then(({ data }) => setOutputs((data as ProjectOutput[]) ?? []));
    setOutputFilter("");
  }, [project]);

  useEffect(() => {
    if (!project) return;

    if (!project.date_debut_projet || !project.date_fin_projet) {
      setErreurDates(true);
      setLoading(false);
      return;
    }
    setErreurDates(false);
    setLoading(true);

    const finEffective =
      project.date_fin_projet > todayIso() ? project.date_fin_projet : todayIso();
    const trimestresCalc = listeTrimestres(project.date_debut_projet, finEffective);
    setTrimestres(trimestresCalc);
    const moisListeCalc = trimestresCalc.flatMap((tr) => tr.mois);

    Promise.all([
      // La ligne placeholder "52B" est naturellement exclue via BUDGET LINE
      // = "-" dans le vrai fichier (pas via son code interne "52B").
      supabase
        .from("budget_lines")
        .select("*")
        .eq("project_id", project.id)
        .neq("budget_line", "-")
        .order("code_1"),
      scopeToProjectSpending(
        supabase.from("journal_entries").select("b_s_line, montant_debit, idc"),
        project
      ),
      cumulAvanceRecue(project),
    ]).then(([lignesRes, entriesRes, avance]) => {
      const budgetLines = (lignesRes.data as BudgetLine[]) ?? [];
      const entries =
        (entriesRes.data as { b_s_line: string | null; montant_debit: number; idc: string | null }[]) ??
        [];

      const totalBudget = budgetLines.reduce((s, l) => s + (l.total_cost ?? 0), 0);

      // Depense par ligne budgetaire (B-S-LINE, sourcee de BUDGET LINE) et
      // par mois (IDC), comme les SUMIFS de BUD TRACKER (JDEPENSE[MT D],
      // JDEPENSE[B-S-LINE], JDEPENSE[IDC]).
      const parLigneEtMois = new Map<string, Map<string, number>>();
      entries.forEach((e) => {
        const code = (e.b_s_line ?? "").toUpperCase();
        if (!code || !e.idc) return;
        if (!parLigneEtMois.has(code)) parLigneEtMois.set(code, new Map());
        const parMois = parLigneEtMois.get(code)!;
        parMois.set(e.idc, (parMois.get(e.idc) ?? 0) + e.montant_debit);
      });

      const calculees: LigneCalculee[] = budgetLines.map((l) => {
        const code = (l.budget_line ?? "").toUpperCase();
        const parMoisLigne = parLigneEtMois.get(code) ?? new Map();
        const parMois: Record<string, number> = {};
        let total = 0;
        moisListeCalc.forEach((m) => {
          const v = parMoisLigne.get(m.idc) ?? 0;
          parMois[m.idc] = v;
          total += v;
        });
        const budget = l.total_cost ?? 0;
        const parRepartition = totalBudget > 0 ? budget / totalBudget : 0;
        const rAvanceAcc = avance * parRepartition;
        return {
          ...l,
          parRepartition,
          rAvanceAcc,
          parMois,
          total,
          solde: budget - total,
          pctConsoB: budget > 0 ? total / budget : 0,
          pctConsoA: rAvanceAcc > 0 ? total / rAvanceAcc : 0,
        };
      });

      setLignes(calculees);
      setCumulAvance(avance);
      setLoading(false);
    });
  }, [project, refreshKey]);

  const totalBudget = lignes.reduce((s, l) => s + (l.total_cost ?? 0), 0);
  const cumulAvanceAffiche = cumulAvance;
  const totalDepenseGlobal = lignes.reduce((s, l) => s + l.total, 0);
  const totalPctConsoBGlobal = totalBudget > 0 ? totalDepenseGlobal / totalBudget : 0;
  const totalPctConsoAGlobal = cumulAvance > 0 ? totalDepenseGlobal / cumulAvance : 0;

  // Filtre Output : axe d'analyse additionnel, independant de la Rubrique -
  // filtre uniquement le tableau/totaux de detail, pas les KPI qui restent
  // des indicateurs globaux du projet.
  const lignesAffichees = outputFilter
    ? lignes.filter((l) => String(l.output_id) === outputFilter)
    : lignes;
  const totalBudgetAffiche = lignesAffichees.reduce((s, l) => s + (l.total_cost ?? 0), 0);
  const totalAjustement = lignesAffichees.reduce((s, l) => s + (l.ajustement ?? 0), 0);
  const totalRAvanceAccAffiche = lignesAffichees.reduce((s, l) => s + l.rAvanceAcc, 0);
  const totalPctRepartitionAffiche = lignesAffichees.reduce((s, l) => s + l.parRepartition, 0);
  const totalDepense = lignesAffichees.reduce((s, l) => s + l.total, 0);
  const totalSolde = totalBudgetAffiche - totalDepense;
  const totalPctConsoB = totalBudgetAffiche > 0 ? totalDepense / totalBudgetAffiche : 0;
  const totalPctConsoA = cumulAvance > 0 ? totalDepense / cumulAvance : 0;
  const nbColMois = trimestres.reduce((s, tr) => s + tr.mois.length + 1, 0);
  const nbColonnesTotal = 4 + (detailOuvert ? 3 : 0) + nbColMois + 5;

  // Largeurs exactes de chaque colonne, dans le meme ordre que les cellules
  // du tableau - imposees via <colgroup> + table-layout:fixed pour que les
  // decalages "left" des colonnes gelees restent toujours exacts, quelle
  // que soit la longueur du contenu (Description en particulier).
  const largeurColonnes = [
    COL_PROJET_W,
    COL_BSLINE_W,
    COL_DESCRIPTION_W,
    COL_BUDGET_W,
    ...(detailOuvert ? [COL_DETAIL_W, COL_DETAIL_W, COL_DETAIL_W] : []),
    ...trimestres.flatMap((tr) => [...tr.mois.map(() => COL_MOIS_W), COL_TOTAL_T_W]),
    COL_TOTALCONSO_W,
    COL_SOLDE_W,
    COL_PCT_W,
    COL_PCT_W,
    COL_DEVISE_W,
  ];
  const largeurTotale = largeurColonnes.reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Barre d'actions - Retour/theme/projet vivent deja dans l'entete
          persistante de l'app ; ici seuls les elements propres a cet ecran. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-accent-blue-solid px-4 py-1.5 text-sm font-bold text-on-accent-dark">
            {t.budTracker.titre}
          </span>
          <Link href="/budget" className="text-sm text-accent-blue hover:underline">
            {t.budTracker.voirFinancialReport}
          </Link>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-accent-blue-solid px-5 py-2 text-sm font-semibold text-on-accent-dark transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
          {t.budTracker.genererLeTracker}
        </button>
      </div>

      {erreurDates && (
        <p className="mb-6 text-sm text-text-secondary">
          {t.budTracker.datesManquantes}{" "}
          <Link href="/parametres/projet" className="text-accent-blue hover:underline">
            {t.budTracker.renseigneDates}
          </Link>{" "}
          {t.budTracker.pourAfficherSuivi}
        </p>
      )}

      {!erreurDates && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-[18px] sm:grid-cols-4">
            <div className="rounded-2xl border border-border-subtle bg-bg-card px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {t.budTracker.budgetApprouve}
              </p>
              <p className="font-display mt-2 text-3xl font-bold text-text-primary">
                {Math.round(totalBudget).toLocaleString("fr-FR")}
              </p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-bg-card px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {t.budTracker.cumulAvanceRecue}
              </p>
              <p className="font-display mt-2 text-3xl font-bold text-accent-blue">
                {Math.round(cumulAvanceAffiche).toLocaleString("fr-FR")}
              </p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-bg-card px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {t.budTracker.tauxConsoBudgetaire}
              </p>
              <p className={`font-display mt-2 text-3xl font-bold ${couleurTaux(totalPctConsoBGlobal)}`}>
                {(totalPctConsoBGlobal * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-bg-card px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {t.budTracker.tauxConsoAvance}
              </p>
              <p className={`font-display mt-2 text-3xl font-bold ${couleurTaux(totalPctConsoAGlobal)}`}>
                {(totalPctConsoAGlobal * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setDetailOuvert((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-card px-4 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-accent-teal hover:text-accent-teal"
            >
              {detailOuvert ? (
                <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {t.budTracker.detailBudget}
            </button>

            {outputs.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  {t.budTracker.filtrerParOutput}
                </label>
                <select
                  value={outputFilter}
                  onChange={(e) => setOutputFilter(e.target.value)}
                  className="rounded-full border border-border-subtle bg-bg-card px-3 py-1.5 text-xs text-text-primary"
                >
                  <option value="">{t.budTracker.tousLesOutputs}</option>
                  {outputs.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.code} — {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="max-h-[65vh] overflow-auto rounded-2xl border border-border-subtle print:max-h-none print:overflow-visible">
            <table
              className="border-separate border-spacing-0 text-sm"
              style={{ tableLayout: "fixed", width: largeurTotale }}
            >
              <colgroup>
                {largeurColonnes.map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    style={{ left: LEFT_PROJET, width: COL_PROJET_W, top: 0 }}
                    className={`${FROZEN_TH} text-left`}
                  >
                    {t.budTracker.colProjet}
                  </th>
                  <th
                    rowSpan={2}
                    style={{ left: LEFT_BSLINE, width: COL_BSLINE_W, top: 0 }}
                    className={`${FROZEN_TH} text-left`}
                  >
                    {t.budTracker.colBSLine}
                  </th>
                  <th
                    rowSpan={2}
                    style={{ left: LEFT_DESCRIPTION, width: COL_DESCRIPTION_W, top: 0 }}
                    className={`${FROZEN_TH} text-left`}
                  >
                    {t.budTracker.colDescription}
                  </th>
                  <th
                    rowSpan={2}
                    style={{ left: LEFT_BUDGET, width: COL_BUDGET_W, top: 0 }}
                    className={`${FROZEN_TH} text-right shadow-[4px_0_8px_-4px_rgba(0,0,0,0.4)]`}
                  >
                    {t.budTracker.colBudgetApprouve}
                  </th>

                  {detailOuvert && (
                    <>
                      <th
                        rowSpan={2}
                        style={{ top: 0 }}
                        className="sticky whitespace-nowrap bg-bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary"
                      >
                        {t.budTracker.colAjustement}
                      </th>
                      <th
                        rowSpan={2}
                        style={{ top: 0 }}
                        className="sticky whitespace-nowrap bg-bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary"
                      >
                        {t.budTracker.colRAvanceAcc}
                      </th>
                      <th
                        rowSpan={2}
                        style={{ top: 0 }}
                        className="sticky whitespace-nowrap bg-bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary"
                      >
                        {t.budTracker.colPctRepartition}
                      </th>
                    </>
                  )}

                  {trimestres.map((tr) => (
                    <th
                      key={tr.label}
                      colSpan={tr.mois.length + 1}
                      style={{ top: 0 }}
                      className="sticky whitespace-nowrap border-b border-border-subtle bg-bg-card px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-text-primary"
                    >
                      {tr.labelCourt}
                    </th>
                  ))}

                  <th
                    rowSpan={2}
                    style={{ top: 0 }}
                    className="sticky whitespace-nowrap bg-bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary"
                  >
                    {t.budTracker.colTotalConso}
                  </th>
                  <th
                    rowSpan={2}
                    style={{ top: 0 }}
                    className="sticky whitespace-nowrap bg-bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary"
                  >
                    {t.budTracker.colSolde}
                  </th>
                  <th
                    rowSpan={2}
                    style={{ top: 0 }}
                    className="sticky whitespace-nowrap bg-bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary"
                  >
                    {t.budTracker.colPctConsoB}
                  </th>
                  <th
                    rowSpan={2}
                    style={{ top: 0 }}
                    className="sticky whitespace-nowrap bg-bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary"
                  >
                    {t.budTracker.colPctConsoA}
                  </th>
                  <th
                    rowSpan={2}
                    style={{ top: 0 }}
                    className="sticky whitespace-nowrap bg-bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary"
                  >
                    {t.budTracker.colTotalDevise}
                  </th>
                </tr>
                <tr>
                  {trimestres.map((tr) => (
                    <Fragment key={tr.label}>
                      {tr.mois.map((m) => (
                        <th
                          key={m.idc}
                          style={{ top: 33 }}
                          className="sticky whitespace-nowrap border-b border-border-subtle bg-bg-card px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary"
                        >
                          {m.label}
                        </th>
                      ))}
                      <th
                        style={{ top: 33 }}
                        className="sticky whitespace-nowrap border-b border-border-subtle bg-bg-card-blue px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-accent-blue"
                      >
                        {t.budTracker.totalT}
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={nbColonnesTotal}
                      className="px-3 py-4 text-center text-text-secondary"
                    >
                      {t.common.chargement}
                    </td>
                  </tr>
                )}
                {!loading && lignesAffichees.length === 0 && (
                  <tr>
                    <td
                      colSpan={nbColonnesTotal}
                      className="px-3 py-4 text-center text-text-secondary"
                    >
                      {t.budTracker.aucuneLigne}
                    </td>
                  </tr>
                )}
                {lignesAffichees.map((l, i) => {
                  const rowBg = i % 2 === 1 ? "bg-bg-card-muted/40" : "";
                  const frozenBg = i % 2 === 1 ? "bg-bg-card-muted" : "bg-bg-card";
                  return (
                    <tr key={l.id} className={`${rowBg} border-b border-border-subtle`}>
                      <td
                        style={{ left: LEFT_PROJET, width: COL_PROJET_W }}
                        className={`${FROZEN_TD} ${frozenBg}`}
                      >
                        {project?.code_projet}
                      </td>
                      <td
                        style={{ left: LEFT_BSLINE, width: COL_BSLINE_W }}
                        className={`${FROZEN_TD} ${frozenBg}`}
                      >
                        {l.budget_line}
                      </td>
                      <td
                        style={{ left: LEFT_DESCRIPTION, width: COL_DESCRIPTION_W }}
                        className={`${FROZEN_TD} ${frozenBg}`}
                      >
                        {l.description}
                      </td>
                      <td
                        style={{ left: LEFT_BUDGET, width: COL_BUDGET_W }}
                        className={`${FROZEN_TD} ${frozenBg} text-right font-semibold shadow-[4px_0_8px_-4px_rgba(0,0,0,0.4)]`}
                      >
                        {(l.total_cost ?? 0).toLocaleString("fr-FR")}
                      </td>

                      {detailOuvert && (
                        <>
                          <td className="border-r border-border-subtle px-3 py-2 text-right text-text-primary">
                            {l.ajustement ? l.ajustement.toLocaleString("fr-FR") : ""}
                          </td>
                          <td className="border-r border-border-subtle px-3 py-2 text-right text-text-primary">
                            {Math.round(l.rAvanceAcc).toLocaleString("fr-FR")}
                          </td>
                          <td className="border-r border-border-subtle px-3 py-2 text-right text-text-primary">
                            {(l.parRepartition * 100).toFixed(1)}%
                          </td>
                        </>
                      )}

                      {trimestres.map((tr) => {
                        const totalTrimestre = tr.mois.reduce(
                          (s, m) => s + (l.parMois[m.idc] ?? 0),
                          0
                        );
                        return (
                          <Fragment key={tr.label}>
                            {tr.mois.map((m) => (
                              <td
                                key={m.idc}
                                className="border-r border-border-subtle px-3 py-2 text-right text-text-primary"
                              >
                                {l.parMois[m.idc] ? l.parMois[m.idc].toLocaleString("fr-FR") : ""}
                              </td>
                            ))}
                            <td className="border-r border-border-subtle bg-bg-card-blue px-3 py-2 text-right font-bold text-accent-blue">
                              {totalTrimestre ? totalTrimestre.toLocaleString("fr-FR") : ""}
                            </td>
                          </Fragment>
                        );
                      })}

                      <td className="border-r border-border-subtle px-3 py-2 text-right font-semibold text-text-primary">
                        {l.total.toLocaleString("fr-FR")}
                      </td>
                      <td className="border-r border-border-subtle px-3 py-2 text-right text-text-primary">
                        {Math.round(l.solde).toLocaleString("fr-FR")}
                      </td>
                      <td className={`border-r border-border-subtle px-3 py-2 text-right font-semibold ${couleurTaux(l.pctConsoB)}`}>
                        {(l.pctConsoB * 100).toFixed(0)}%
                      </td>
                      <td className={`border-r border-border-subtle px-3 py-2 text-right font-semibold ${couleurTaux(l.pctConsoA)}`}>
                        {(l.pctConsoA * 100).toFixed(0)}%
                      </td>
                      <td className="px-3 py-2 text-right text-text-secondary">
                        {project?.taux_conversion
                          ? (l.total / project.taux_conversion).toLocaleString("fr-FR", {
                              maximumFractionDigits: 2,
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {lignesAffichees.length > 0 && (
                <tfoot>
                  <tr className="font-bold text-text-primary">
                    <td
                      colSpan={3}
                      style={{ left: LEFT_PROJET }}
                      className={`${FROZEN_TD} bg-bg-card-muted`}
                    >
                      {t.budTracker.totalGeneral}
                    </td>
                    <td
                      style={{ left: LEFT_BUDGET, width: COL_BUDGET_W }}
                      className={`${FROZEN_TD} bg-bg-card-muted text-right shadow-[4px_0_8px_-4px_rgba(0,0,0,0.4)]`}
                    >
                      {Math.round(totalBudgetAffiche).toLocaleString("fr-FR")}
                    </td>

                    {detailOuvert && (
                      <>
                        <td className="border-r border-border-subtle bg-bg-card-muted px-3 py-2 text-right">
                          {totalAjustement ? totalAjustement.toLocaleString("fr-FR") : ""}
                        </td>
                        <td className="border-r border-border-subtle bg-bg-card-muted px-3 py-2 text-right">
                          {Math.round(totalRAvanceAccAffiche).toLocaleString("fr-FR")}
                        </td>
                        <td className="border-r border-border-subtle bg-bg-card-muted px-3 py-2 text-right">
                          {(totalPctRepartitionAffiche * 100).toFixed(1)}%
                        </td>
                      </>
                    )}

                    {trimestres.map((tr) => {
                      const totalTrimestre = lignesAffichees.reduce(
                        (s, l) => s + tr.mois.reduce((s2, m) => s2 + (l.parMois[m.idc] ?? 0), 0),
                        0
                      );
                      return (
                        <Fragment key={tr.label}>
                          {tr.mois.map((m) => (
                            <td
                              key={m.idc}
                              className="border-r border-border-subtle bg-bg-card-muted px-3 py-2 text-right"
                            >
                              {lignesAffichees
                                .reduce((s, l) => s + (l.parMois[m.idc] ?? 0), 0)
                                .toLocaleString("fr-FR")}
                            </td>
                          ))}
                          <td className="border-r border-border-subtle bg-bg-card-blue px-3 py-2 text-right text-accent-blue">
                            {totalTrimestre.toLocaleString("fr-FR")}
                          </td>
                        </Fragment>
                      );
                    })}

                    <td className="border-r border-border-subtle bg-bg-card-muted px-3 py-2 text-right">
                      {totalDepense.toLocaleString("fr-FR")}
                    </td>
                    <td className="border-r border-border-subtle bg-bg-card-muted px-3 py-2 text-right">
                      {Math.round(totalSolde).toLocaleString("fr-FR")}
                    </td>
                    <td className={`border-r border-border-subtle bg-bg-card-muted px-3 py-2 text-right ${couleurTaux(totalPctConsoB)}`}>
                      {(totalPctConsoB * 100).toFixed(0)}%
                    </td>
                    <td className={`border-r border-border-subtle bg-bg-card-muted px-3 py-2 text-right ${couleurTaux(totalPctConsoA)}`}>
                      {(totalPctConsoA * 100).toFixed(0)}%
                    </td>
                    <td className="bg-bg-card-muted px-3 py-2 text-right text-text-secondary">
                      {project?.taux_conversion
                        ? (totalDepense / project.taux_conversion).toLocaleString("fr-FR", {
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
