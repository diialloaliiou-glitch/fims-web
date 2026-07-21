"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { scopeToProjectSpending } from "@/lib/project-scope";
import { cumulAvanceRecue } from "@/lib/avance-recue";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { StatCard } from "@/components/ui/StatCard";
import type { BudgetLine } from "@/lib/types";

type Mois = { idc: string; label: string };
type Trimestre = { mois: Mois[]; label: string };

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
    trimestres.push({
      mois: mois.slice(i, i + 3),
      label: `Total - T${trimestres.length + 1}`,
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

export default function BudTrackerPage() {
  const { project } = useAuth();
  const { t } = useLanguage();
  const [lignes, setLignes] = useState<LigneCalculee[]>([]);
  const [trimestres, setTrimestres] = useState<Trimestre[]>([]);
  const [cumulAvance, setCumulAvance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erreurDates, setErreurDates] = useState(false);

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
  }, [project]);

  const totalBudget = lignes.reduce((s, l) => s + (l.total_cost ?? 0), 0);
  const totalAjustement = lignes.reduce((s, l) => s + (l.ajustement ?? 0), 0);
  const totalDepense = lignes.reduce((s, l) => s + l.total, 0);
  const totalSolde = totalBudget - totalDepense;
  const totalPctConsoB = totalBudget > 0 ? totalDepense / totalBudget : 0;
  const totalPctConsoA = cumulAvance > 0 ? totalDepense / cumulAvance : 0;
  const nbColMois = trimestres.reduce((s, tr) => s + tr.mois.length + 1, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text-primary">{t.budTracker.titre}</h1>
        <Link href="/budget" className="text-sm text-accent-blue hover:underline">
          {t.budTracker.voirFinancialReport}
        </Link>
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
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard label={t.budTracker.budgetApprouve} value={Math.round(totalBudget).toLocaleString("fr-FR")} />
            <StatCard
              label={t.budTracker.cumulAvanceRecue}
              value={Math.round(cumulAvance).toLocaleString("fr-FR")}
              valueColor="blue"
            />
            <StatCard
              label={t.budTracker.tauxConsoBudgetaire}
              value={`${(totalPctConsoB * 100).toFixed(1)}%`}
              valueColor="teal"
            />
            <StatCard
              label={t.budTracker.tauxConsoAvance}
              value={`${(totalPctConsoA * 100).toFixed(1)}%`}
              valueColor="amber"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="min-w-full text-sm">
              <MiniTableHeader
                columns={[
                  t.budTracker.colProjet,
                  t.budTracker.colBSLine,
                  t.budTracker.colDescription,
                  t.budTracker.colBudgetApprouve,
                  t.budTracker.colAjustement,
                  t.budTracker.colRAvanceAcc,
                  t.budTracker.colPctRepartition,
                  ...trimestres.flatMap((tr) => [...tr.mois.map((m) => m.label), tr.label]),
                  t.budTracker.colTotalConso,
                  t.budTracker.colSolde,
                  t.budTracker.colPctConsoB,
                  t.budTracker.colPctConsoA,
                  t.budTracker.colTotalDevise,
                ]}
                align={[
                  "left",
                  "left",
                  "left",
                  "right",
                  "right",
                  "right",
                  "right",
                  ...trimestres.flatMap((tr) => [...tr.mois.map(() => "right" as const), "right" as const]),
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                ]}
              />
              <tbody className="divide-y divide-border-subtle bg-bg-card/60">
                {loading && (
                  <tr>
                    <td colSpan={12 + nbColMois} className="px-3 py-4 text-center text-text-secondary">
                      {t.common.chargement}
                    </td>
                  </tr>
                )}
                {!loading && lignes.length === 0 && (
                  <tr>
                    <td colSpan={12 + nbColMois} className="px-3 py-4 text-center text-text-secondary">
                      {t.budTracker.aucuneLigne}
                    </td>
                  </tr>
                )}
                {lignes.map((l) => (
                  <tr key={l.id} className="text-text-primary">
                    <td className="px-3 py-2">{project?.code_projet}</td>
                    <td className="px-3 py-2">{l.budget_line}</td>
                    <td className="px-3 py-2">{l.description}</td>
                    <td className="px-3 py-2 text-right">
                      {(l.total_cost ?? 0).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {l.ajustement ? l.ajustement.toLocaleString("fr-FR") : ""}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(l.rAvanceAcc).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(l.parRepartition * 100).toFixed(1)}%
                    </td>
                    {trimestres.map((tr) => {
                      const totalTrimestre = tr.mois.reduce(
                        (s, m) => s + (l.parMois[m.idc] ?? 0),
                        0
                      );
                      return (
                        <Fragment key={tr.label}>
                          {tr.mois.map((m) => (
                            <td key={m.idc} className="px-3 py-2 text-right">
                              {l.parMois[m.idc] ? l.parMois[m.idc].toLocaleString("fr-FR") : ""}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right font-medium">
                            {totalTrimestre ? totalTrimestre.toLocaleString("fr-FR") : ""}
                          </td>
                        </Fragment>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-medium">
                      {l.total.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(l.solde).toLocaleString("fr-FR")}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${
                        l.pctConsoB > 1 ? "text-accent-red" : ""
                      }`}
                    >
                      {(l.pctConsoB * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-right">{(l.pctConsoA * 100).toFixed(0)}%</td>
                    <td className="px-3 py-2 text-right text-text-secondary">—</td>
                  </tr>
                ))}
              </tbody>
              {lignes.length > 0 && (
                <tfoot className="bg-bg-card font-semibold text-text-primary">
                  <tr>
                    <td className="px-3 py-2" colSpan={3}>
                      {t.budTracker.totalGeneral}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(totalBudget).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {totalAjustement ? totalAjustement.toLocaleString("fr-FR") : ""}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(cumulAvance).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">100%</td>
                    {trimestres.map((tr) => {
                      const totalTrimestre = lignes.reduce(
                        (s, l) => s + tr.mois.reduce((s2, m) => s2 + (l.parMois[m.idc] ?? 0), 0),
                        0
                      );
                      return (
                        <Fragment key={tr.label}>
                          {tr.mois.map((m) => (
                            <td key={m.idc} className="px-3 py-2 text-right">
                              {lignes
                                .reduce((s, l) => s + (l.parMois[m.idc] ?? 0), 0)
                                .toLocaleString("fr-FR")}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right">
                            {totalTrimestre.toLocaleString("fr-FR")}
                          </td>
                        </Fragment>
                      );
                    })}
                    <td className="px-3 py-2 text-right">
                      {totalDepense.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(totalSolde).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(totalPctConsoB * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(totalPctConsoA * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-right text-text-secondary">—</td>
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
