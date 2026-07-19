"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { BudgetLine, Donor, JournalEntry } from "@/lib/types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

// Reproduit fidèlement CalculerDepenseReelle() du FIMS VBA d'origine :
// somme des montant_debit dont b_s_line = our_line_code, hors comptes
// tresorerie (5xxxxx) et comptes 411xxx, filtre sur date_heure_saisie
// (pas date_operation) entre dateDebut et dateFin inclus.
function calculerDepenseReelle(
  entries: JournalEntry[],
  ourLineCode: string,
  dateDebut: string,
  dateFin: string
): number {
  const code = ourLineCode.toUpperCase();
  let total = 0;
  entries.forEach((e) => {
    if (!e.montant_debit) return;
    const bsl = (e.b_s_line ?? "").toUpperCase();
    if (bsl !== code || bsl === "52B") return;
    const dateSaisie = e.date_heure_saisie.slice(0, 10);
    if (dateSaisie < dateDebut || dateSaisie > dateFin) return;
    const compteD = e.compte_debit ?? "";
    if (compteD.startsWith("5") || compteD.startsWith("411")) return;
    total += e.montant_debit;
  });
  return total;
}

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type ReportRow = BudgetLine & {
  priorExp: number;
  periodExp: number;
  periodExpDevise: number;
  variance: number;
  burnRate: number;
};

export default function FinancialReportPage() {
  const { project } = useAuth();
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [donor, setDonor] = useState<Donor | null>(null);
  const [periodeDebut, setPeriodeDebut] = useState(firstOfMonthIso());
  const [periodeFin, setPeriodeFin] = useState(todayIso());
  const [tauxChange, setTauxChange] = useState("560");
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
      setEntries((entriesRes.data as JournalEntry[]) ?? []);
      setLoading(false);
    });
  }, [project]);

  useEffect(() => {
    // donor lookup — projects table doesn't expose organization_id-scoped
    // donor join directly, so fetch via project's donor_id separately.
    if (!project) return;
    supabase
      .from("projects")
      .select("donor_id")
      .eq("id", project.id)
      .single()
      .then(({ data }) => {
        if (!data?.donor_id) return;
        supabase
          .from("donors")
          .select("*")
          .eq("id", data.donor_id)
          .single()
          .then(({ data: donorData }) => setDonor((donorData as Donor) ?? null));
      });
  }, [project]);

  const tauxNum = parseFloat(tauxChange) || 1;
  const dateDebutProjet = project?.date_debut_projet ?? periodeDebut;

  const rows: ReportRow[] = lines.map((l) => {
    const code = l.our_line_code ?? "";
    const priorExp = code
      ? calculerDepenseReelle(entries, code, dateDebutProjet, addDays(periodeDebut, -1))
      : 0;
    const periodExp = code
      ? calculerDepenseReelle(entries, code, periodeDebut, periodeFin)
      : 0;
    const budget = l.total_cost ?? 0;
    const variance = budget - (priorExp + periodExp);
    const burnRate = budget !== 0 ? (priorExp + periodExp) / budget : 0;
    return {
      ...l,
      priorExp,
      periodExp,
      periodExpDevise: periodExp / tauxNum,
      variance,
      burnRate,
    };
  });

  const totalBudget = rows.reduce((s, r) => s + (r.total_cost ?? 0), 0);
  const totalPrior = rows.reduce((s, r) => s + r.priorExp, 0);
  const totalPeriod = rows.reduce((s, r) => s + r.periodExp, 0);
  const globalBurnRate = totalBudget !== 0 ? (totalPrior + totalPeriod) / totalBudget : 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-100">
          Financial Report
        </h1>
        <div className="flex gap-4">
          <Link href="/reporting" className="text-sm text-sky-400 hover:underline">
            Voir le Reporting →
          </Link>
          <Link href="/budget/staging" className="text-sm text-sky-400 hover:underline">
            Gérer les propositions budgétaires →
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4 sm:grid-cols-3">
        <p className="text-sm text-slate-300">
          Project Name : <span className="font-medium">{project?.nom_projet}</span>
        </p>
        <p className="text-sm text-slate-300">
          Partner Name : <span className="font-medium">{donor?.nom ?? "—"}</span>
        </p>
        <p className="text-sm text-slate-300">
          Project Code : <span className="font-medium">{project?.code_projet}</span>
        </p>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Period From</label>
          <input
            type="date"
            value={periodeDebut}
            onChange={(e) => setPeriodeDebut(e.target.value)}
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Period To</label>
          <input
            type="date"
            value={periodeFin}
            onChange={(e) => setPeriodeFin(e.target.value)}
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">
            Exchange Rate (FCFA → USD)
          </label>
          <input
            type="number"
            step="0.01"
            value={tauxChange}
            onChange={(e) => setTauxChange(e.target.value)}
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Budget</p>
          <p className="mt-1 text-xl font-bold text-slate-100">
            {Math.round(totalBudget).toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Prior + Period Exp.</p>
          <p className="mt-1 text-xl font-bold text-amber-400">
            {Math.round(totalPrior + totalPeriod).toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">Variance</p>
          <p className="mt-1 text-xl font-bold text-emerald-400">
            {Math.round(totalBudget - totalPrior - totalPeriod).toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">GLOBAL BURN RATE</p>
          <p className="mt-1 text-xl font-bold text-sky-400">
            {(globalBurnRate * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        Report Currency : FCFA · Exchange Currency : USD. "Prior Exp." = dépenses
        depuis le début du projet ({dateDebutProjet}) jusqu&apos;à la veille de
        "Period From". Même méthodologie que Reporting (b_s_line = our_line_code,
        hors comptes 5xxxxx/411xxx, débit uniquement).
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Unit</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Freq.</th>
              <th className="px-3 py-2 text-right">% TO PROJECT</th>
              <th className="px-3 py-2 text-right">Budget</th>
              <th className="px-3 py-2 text-right">Prior Exp.</th>
              <th className="px-3 py-2 text-right">Period Exp.</th>
              <th className="px-3 py-2 text-right">Period Exp. (USD)</th>
              <th className="px-3 py-2 text-right">Variance</th>
              <th className="px-3 py-2 text-right">Burn Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/40">
            {loading && (
              <tr>
                <td colSpan={12} className="px-3 py-4 text-center text-slate-400">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="text-slate-200">
                  <td className="px-3 py-2">{r.our_line_code}</td>
                  <td className="px-3 py-2">{r.description}</td>
                  <td className="px-3 py-2 text-slate-400">{r.unit}</td>
                  <td className="px-3 py-2 text-right">{r.quantity ?? ""}</td>
                  <td className="px-3 py-2 text-right">{r.frequence ?? ""}</td>
                  <td className="px-3 py-2 text-right">{r.t_pec}</td>
                  <td className="px-3 py-2 text-right">
                    {(r.total_cost ?? 0).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.priorExp.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.periodExp.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.periodExpDevise.toLocaleString("fr-FR", {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {Math.round(r.variance).toLocaleString("fr-FR")}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${
                      r.burnRate > 1 ? "text-red-400" : "text-slate-300"
                    }`}
                  >
                    {(r.burnRate * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-slate-800 font-semibold text-slate-100">
              <tr>
                <td className="px-3 py-2" colSpan={6}>
                  TOTAL
                </td>
                <td className="px-3 py-2 text-right">
                  {Math.round(totalBudget).toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {Math.round(totalPrior).toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {Math.round(totalPeriod).toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {(totalPeriod / tauxNum).toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3 py-2 text-right">
                  {Math.round(totalBudget - totalPrior - totalPeriod).toLocaleString(
                    "fr-FR"
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {(globalBurnRate * 100).toFixed(0)}%
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
