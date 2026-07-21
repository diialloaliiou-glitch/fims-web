"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { scopeToProjectSpending } from "@/lib/project-scope";
import { cumulAvanceRecue } from "@/lib/avance-recue";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { StatCard } from "@/components/ui/StatCard";
import type { BudgetLine } from "@/lib/types";

type Mois = { idc: string; label: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function listeMois(debut: string, fin: string): Mois[] {
  const result: Mois[] = [];
  const cursor = new Date(debut);
  const end = new Date(fin);
  cursor.setDate(1);
  end.setDate(1);
  while (cursor <= end) {
    const m = cursor.getMonth() + 1;
    const y = cursor.getFullYear();
    result.push({
      idc: `${m}_${y}`,
      label: cursor.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

type LigneCalculee = BudgetLine & {
  parRepartition: number;
  rAvanceAcc: number;
  parMois: Record<string, number>;
  total: number;
  ecart: number;
  pctConso: number;
  pctConsoAvance: number;
};

export default function BudTrackerPage() {
  const { project } = useAuth();
  const [lignes, setLignes] = useState<LigneCalculee[]>([]);
  const [mois, setMois] = useState<Mois[]>([]);
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

    // Etend la plage jusqu'a aujourd'hui si des ecritures existent apres la
    // date de fin officielle du projet (sinon leur montant disparaitrait
    // silencieusement des totaux, faute de colonne mois correspondante).
    const finEffective =
      project.date_fin_projet > todayIso() ? project.date_fin_projet : todayIso();
    const moisListeCalc = listeMois(project.date_debut_projet, finEffective);
    setMois(moisListeCalc);

    Promise.all([
      supabase
        .from("budget_lines")
        .select("*")
        .eq("project_id", project.id)
        .neq("our_line_code", "52B")
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

      // Depense par ligne budgetaire et par mois (IDC), comme les SUMIFS
      // de BUD TRACKER (JDEPENSE[MT D], JDEPENSE[B-S-LINE], JDEPENSE[IDC]).
      const parLigneEtMois = new Map<string, Map<string, number>>();
      entries.forEach((e) => {
        const code = (e.b_s_line ?? "").toUpperCase();
        if (!code || code === "52B" || !e.idc) return;
        if (!parLigneEtMois.has(code)) parLigneEtMois.set(code, new Map());
        const parMois = parLigneEtMois.get(code)!;
        parMois.set(e.idc, (parMois.get(e.idc) ?? 0) + e.montant_debit);
      });

      const calculees: LigneCalculee[] = budgetLines.map((l) => {
        const code = (l.our_line_code ?? "").toUpperCase();
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
          ecart: budget - total,
          pctConso: budget > 0 ? total / budget : 0,
          pctConsoAvance: rAvanceAcc > 0 ? total / rAvanceAcc : 0,
        };
      });

      setLignes(calculees);
      setCumulAvance(avance);
      setLoading(false);
    });
  }, [project]);

  const totalBudget = lignes.reduce((s, l) => s + (l.total_cost ?? 0), 0);
  const totalDepense = lignes.reduce((s, l) => s + l.total, 0);
  const totalEcart = totalBudget - totalDepense;
  const totalPctConso = totalBudget > 0 ? totalDepense / totalBudget : 0;
  const totalPctConsoAvance = cumulAvance > 0 ? totalDepense / cumulAvance : 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text-primary">BUD TRACKER</h1>
        <Link href="/budget" className="text-sm text-accent-blue hover:underline">
          Voir le Financial Report →
        </Link>
      </div>

      {erreurDates && (
        <p className="mb-6 text-sm text-text-secondary">
          Les dates de début et de fin du projet ne sont pas renseignées.{" "}
          <Link href="/parametres/projet" className="text-accent-blue hover:underline">
            Renseigne-les dans Paramètres du projet
          </Link>{" "}
          pour afficher le suivi mensuel.
        </p>
      )}

      {!erreurDates && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard label="Budget approuvé" value={Math.round(totalBudget).toLocaleString("fr-FR")} />
            <StatCard
              label="Cumul avance reçue"
              value={Math.round(cumulAvance).toLocaleString("fr-FR")}
              valueColor="blue"
            />
            <StatCard
              label="Taux de conso budgétaire"
              value={`${(totalPctConso * 100).toFixed(1)}%`}
              valueColor="teal"
            />
            <StatCard
              label="Taux de conso de l'avance"
              value={`${(totalPctConsoAvance * 100).toFixed(1)}%`}
              valueColor="amber"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="min-w-full text-sm">
              <MiniTableHeader
                columns={[
                  "B-S-Line",
                  "Description",
                  "Budget approuvé",
                  "% répartition",
                  ...mois.map((m) => m.label),
                  "Total",
                  "Écart",
                  "% conso",
                  "R-avance acc.",
                  "% conso avance",
                ]}
                align={[
                  "left",
                  "left",
                  "right",
                  "right",
                  ...mois.map(() => "right" as const),
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
                    <td colSpan={9 + mois.length} className="px-3 py-4 text-center text-text-secondary">
                      Chargement...
                    </td>
                  </tr>
                )}
                {!loading && lignes.length === 0 && (
                  <tr>
                    <td colSpan={9 + mois.length} className="px-3 py-4 text-center text-text-secondary">
                      Aucune ligne budgétaire.
                    </td>
                  </tr>
                )}
                {lignes.map((l) => (
                  <tr key={l.id} className="text-text-primary">
                    <td className="px-3 py-2">{l.our_line_code}</td>
                    <td className="px-3 py-2">{l.description}</td>
                    <td className="px-3 py-2 text-right">
                      {(l.total_cost ?? 0).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(l.parRepartition * 100).toFixed(1)}%
                    </td>
                    {mois.map((m) => (
                      <td key={m.idc} className="px-3 py-2 text-right">
                        {l.parMois[m.idc] ? l.parMois[m.idc].toLocaleString("fr-FR") : ""}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-medium">
                      {l.total.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(l.ecart).toLocaleString("fr-FR")}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${
                        l.pctConso > 1 ? "text-accent-red" : ""
                      }`}
                    >
                      {(l.pctConso * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(l.rAvanceAcc).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(l.pctConsoAvance * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              {lignes.length > 0 && (
                <tfoot className="bg-bg-card font-semibold text-text-primary">
                  <tr>
                    <td className="px-3 py-2" colSpan={2}>
                      TOTAL GENERAL
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(totalBudget).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">100%</td>
                    {mois.map((m) => (
                      <td key={m.idc} className="px-3 py-2 text-right">
                        {lignes
                          .reduce((s, l) => s + (l.parMois[m.idc] ?? 0), 0)
                          .toLocaleString("fr-FR")}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      {totalDepense.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(totalEcart).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(totalPctConso * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(cumulAvance).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(totalPctConsoAvance * 100).toFixed(0)}%
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
