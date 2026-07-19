"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { BudgetLine, JournalEntry } from "@/lib/types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type ReportRow = BudgetLine & { depense: number };

// Reproduit fidèlement CalculerDepenseReelle() du FIMS original (VBA) :
// somme des montant_debit dont b_s_line = our_line_code de la ligne
// budgétaire, hors comptes trésorerie (5xxxxx) et hors comptes 411xxx,
// filtré sur date_heure_saisie (pas date_operation).
function calculerDepensesParLigne(
  entries: JournalEntry[],
  asOf: string
): Map<string, number> {
  const totals = new Map<string, number>();
  const borneFin = new Date(asOf);
  borneFin.setDate(borneFin.getDate() + 1);

  entries.forEach((e) => {
    if (!e.montant_debit) return;
    const bsl = (e.b_s_line ?? "").toUpperCase();
    if (!bsl || bsl === "52B") return;
    const dateSaisie = new Date(e.date_heure_saisie.slice(0, 10));
    if (dateSaisie >= borneFin) return;
    const compteD = e.compte_debit ?? "";
    if (compteD.startsWith("5") || compteD.startsWith("411")) return;
    totals.set(bsl, (totals.get(bsl) ?? 0) + e.montant_debit);
  });

  return totals;
}

export default function FinancialReportPage() {
  const { project } = useAuth();
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [depenses, setDepenses] = useState<Map<string, number>>(new Map());
  const [asOf, setAsOf] = useState(todayIso());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project) return;
    setLoading(true);

    Promise.all([
      supabase
        .from("budget_lines")
        .select("*")
        .eq("project_id", project.id)
        .neq("our_line_code", "52B")
        .order("code_1"),
      supabase
        .from("journal_entries")
        .select("b_s_line, compte_debit, montant_debit, date_heure_saisie")
        .eq("project_id", project.id),
    ]).then(([linesRes, entriesRes]) => {
      setLines((linesRes.data as BudgetLine[]) ?? []);
      const entries = (entriesRes.data as JournalEntry[]) ?? [];
      setDepenses(calculerDepensesParLigne(entries, asOf));
      setLoading(false);
    });
  }, [project, asOf]);

  const rows: ReportRow[] = lines.map((l) => ({
    ...l,
    depense: l.our_line_code
      ? depenses.get(l.our_line_code.toUpperCase()) ?? 0
      : 0,
  }));

  const totalBudget = rows.reduce((sum, r) => sum + (r.total_cost ?? 0), 0);
  const totalDepense = rows.reduce((sum, r) => sum + r.depense, 0);
  const totalDisponible = totalBudget - totalDepense;
  const tauxGlobal = totalBudget > 0 ? (totalDepense / totalBudget) * 100 : 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-100">
          Financial Report
        </h1>
        <Link
          href="/budget/staging"
          className="text-sm text-sky-400 hover:underline"
        >
          Gérer les propositions budgétaires →
        </Link>
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <label className="text-sm text-slate-300">Situation au</label>
        <input
          type="date"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Budget approuvé</p>
          <p className="mt-1 text-xl font-bold text-slate-100">
            {Math.round(totalBudget).toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Dépensé</p>
          <p className="mt-1 text-xl font-bold text-amber-400">
            {Math.round(totalDepense).toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Disponible</p>
          <p className="mt-1 text-xl font-bold text-emerald-400">
            {Math.round(totalDisponible).toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Taux de consommation</p>
          <p className="mt-1 text-xl font-bold text-sky-400">
            {tauxGlobal.toFixed(1)}%
          </p>
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        Méthodologie identique au Financial Report FIMS d&apos;origine : le
        montant "Dépensé" additionne les écritures dont la ligne B-S-Line
        correspond au code de la ligne budgétaire, en ne comptant que le débit
        (jamais le crédit), hors comptes de trésorerie (5xxxxx) — pour éviter
        de compter deux fois un même règlement.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">Ligne</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Rubrique</th>
              <th className="px-3 py-2 text-right">Budget</th>
              <th className="px-3 py-2 text-right">Dépensé</th>
              <th className="px-3 py-2 text-right">Disponible</th>
              <th className="px-3 py-2 text-right">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/40">
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => {
                const budget = r.total_cost ?? 0;
                const disponible = budget - r.depense;
                const taux = budget > 0 ? (r.depense / budget) * 100 : 0;
                return (
                  <tr key={r.id} className="text-slate-200">
                    <td className="px-3 py-2">{r.code_1}</td>
                    <td className="px-3 py-2">{r.description}</td>
                    <td className="px-3 py-2 text-slate-400">{r.rubrique}</td>
                    <td className="px-3 py-2 text-right">
                      {budget.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.depense.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {disponible.toLocaleString("fr-FR")}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        taux > 100 ? "text-red-400" : "text-slate-300"
                      }`}
                    >
                      {taux.toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-slate-800 font-semibold text-slate-100">
              <tr>
                <td className="px-3 py-2" colSpan={3}>
                  TOTAUX
                </td>
                <td className="px-3 py-2 text-right">
                  {Math.round(totalBudget).toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {Math.round(totalDepense).toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {Math.round(totalDisponible).toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">{tauxGlobal.toFixed(0)}%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
