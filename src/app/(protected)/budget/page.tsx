"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { exporterCsv } from "@/lib/export-csv";
import { FormField } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { Pill } from "@/components/ui/Pill";
import { StatCard } from "@/components/ui/StatCard";
import { scopeToProjectSpending } from "@/lib/project-scope";
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
      scopeToProjectSpending(
        supabase
          .from("journal_entries")
          .select("b_s_line, compte_debit, montant_debit, date_heure_saisie"),
        project
      ),
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
        <h1 className="text-2xl font-semibold text-text-primary">
          Financial Report
        </h1>
        <div className="flex gap-4 print:hidden">
          <Link href="/reporting" className="text-sm text-accent-blue hover:underline">
            Voir le Reporting →
          </Link>
          <Link href="/budget/staging" className="text-sm text-accent-blue hover:underline">
            Gérer les propositions budgétaires →
          </Link>
          <Pill
            onClick={() =>
              exporterCsv(
                "FinancialReport",
                [
                  "Code",
                  "Description",
                  "Unit",
                  "Qty",
                  "Freq.",
                  "% TO PROJECT",
                  "Budget",
                  "Prior Exp.",
                  "Period Exp.",
                  "Period Exp. (USD)",
                  "Variance",
                  "Burn Rate",
                ],
                rows.map((r) => [
                  r.our_line_code,
                  r.description,
                  r.unit,
                  r.quantity,
                  r.frequence,
                  r.t_pec,
                  r.total_cost,
                  r.priorExp,
                  r.periodExp,
                  r.periodExpDevise,
                  r.variance,
                  `${(r.burnRate * 100).toFixed(0)}%`,
                ])
              )
            }
          >
            Export Excel
          </Pill>
          <Pill onClick={() => window.print()}>Export PDF</Pill>
          <Pill solid onClick={() => window.print()}>
            Imprimer
          </Pill>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-border-subtle bg-bg-card p-4 sm:grid-cols-3">
        <p className="text-sm text-text-secondary">
          Project Name : <span className="font-medium">{project?.nom_projet}</span>
        </p>
        <p className="text-sm text-text-secondary">
          Partner Name : <span className="font-medium">{donor?.nom ?? "—"}</span>
        </p>
        <p className="text-sm text-text-secondary">
          Project Code : <span className="font-medium">{project?.code_projet}</span>
        </p>
        <FormField
          label="Period From"
          type="date"
          value={periodeDebut}
          onChange={(e) => setPeriodeDebut(e.target.value)}
        />
        <FormField
          label="Period To"
          type="date"
          value={periodeFin}
          onChange={(e) => setPeriodeFin(e.target.value)}
        />
        <FormField
          label="Exchange Rate (FCFA → USD)"
          type="number"
          step="0.01"
          value={tauxChange}
          onChange={(e) => setTauxChange(e.target.value)}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Budget" value={Math.round(totalBudget).toLocaleString("fr-FR")} />
        <StatCard
          label="Prior + Period Exp."
          value={Math.round(totalPrior + totalPeriod).toLocaleString("fr-FR")}
          valueColor="amber"
        />
        <StatCard
          label="Variance"
          value={Math.round(totalBudget - totalPrior - totalPeriod).toLocaleString("fr-FR")}
          valueColor="teal"
        />
        <StatCard
          label="GLOBAL BURN RATE"
          value={`${(globalBurnRate * 100).toFixed(1)}%`}
          valueColor="blue"
        />
      </div>

      <p className="mb-3 text-xs text-text-secondary">
        Report Currency : FCFA · Exchange Currency : USD. "Prior Exp." = dépenses
        depuis le début du projet ({dateDebutProjet}) jusqu&apos;à la veille de
        "Period From". Même méthodologie que Reporting (b_s_line = our_line_code,
        hors comptes 5xxxxx/411xxx, débit uniquement).
      </p>

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-full text-sm">
          <MiniTableHeader
            columns={["Code", "Description", "Unit", "Qty", "Freq.", "% TO PROJECT", "Budget", "Prior Exp.", "Period Exp.", "Period Exp. (USD)", "Variance", "Burn Rate"]}
            align={["left", "left", "left", "right", "right", "right", "right", "right", "right", "right", "right", "right"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={12} className="px-3 py-4 text-center text-text-secondary">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="text-text-primary">
                  <td className="px-3 py-2">{r.our_line_code}</td>
                  <td className="px-3 py-2">{r.description}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.unit}</td>
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
                      r.burnRate > 1 ? "text-accent-red" : "text-text-secondary"
                    }`}
                  >
                    {(r.burnRate * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-bg-card font-semibold text-text-primary">
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
