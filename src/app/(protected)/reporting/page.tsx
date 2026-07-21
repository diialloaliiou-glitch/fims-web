"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { exporterCsv } from "@/lib/export-csv";
import { FormField } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { Pill } from "@/components/ui/Pill";
import { StatCard } from "@/components/ui/StatCard";
import { scopeToProjectSpending } from "@/lib/project-scope";
import type { BudgetLine, JournalEntry, Zone } from "@/lib/types";

function firstOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type ReportRow = {
  date: string;
  partCode: string;
  partCCode: string;
  ourLineCode: string;
  journal: string | null;
  compte: string | null;
  libelle: string;
  ref: string | null;
  zone: string;
  montant: number;
  nPiece: string | null;
};

// Reproduit GenererReporting() du FIMS VBA d'origine : liste detaillee
// des transactions (montant_debit only, hors comptes 5xxxxx/411xxx,
// hors ligne placeholder "52B"), categorisees par ligne budgetaire.
function calculerReporting(
  entries: JournalEntry[],
  budgetByLine: Map<string, { code_1: string; icp: string }>,
  zoneById: Map<number, string>
): ReportRow[] {
  const rows: ReportRow[] = [];

  entries.forEach((e) => {
    if (!e.montant_debit) return;
    const compteD = e.compte_debit ?? "";
    if (compteD.startsWith("5") || compteD.startsWith("411")) return;
    const bsl = (e.b_s_line ?? "").trim();
    if (bsl.toUpperCase() === "52B") return;

    const budget = budgetByLine.get(bsl.toUpperCase());

    rows.push({
      date: e.date_operation,
      partCode: budget?.code_1 ?? "",
      partCCode: budget?.icp ?? "",
      ourLineCode: bsl,
      journal: e.journal,
      compte: e.compte_debit,
      libelle: e.libelle,
      ref: e.n_cheque_ov,
      zone: e.zone_id != null ? zoneById.get(e.zone_id) ?? "" : "",
      montant: e.montant_debit,
      nPiece: e.n_piece,
    });
  });

  return rows;
}

export default function ReportingPage() {
  const { project } = useAuth();
  const { t } = useLanguage();
  const [dateDebut, setDateDebut] = useState(firstOfMonthIso());
  const [dateFin, setDateFin] = useState(todayIso());
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project) return;
    setLoading(true);

    Promise.all([
      scopeToProjectSpending(
        supabase
          .from("journal_entries")
          .select("*")
          .gte("date_operation", dateDebut)
          .lte("date_operation", dateFin),
        project
      ),
      supabase.from("budget_lines").select("*").eq("project_id", project.id),
      supabase
        .from("zones")
        .select("*")
        .eq("organization_id", project.organization_id),
    ]).then(([entriesRes, budgetRes, zonesRes]) => {
      const entries = (entriesRes.data as JournalEntry[]) ?? [];
      const budgetLines = (budgetRes.data as BudgetLine[]) ?? [];
      const zones = (zonesRes.data as Zone[]) ?? [];

      const budgetByLine = new Map<string, { code_1: string; icp: string }>();
      budgetLines.forEach((b) => {
        if (b.our_line_code) {
          budgetByLine.set(b.our_line_code.toUpperCase(), {
            code_1: b.code_1,
            icp: b.icp ?? "",
          });
        }
      });

      const zoneById = new Map<number, string>();
      zones.forEach((z) => zoneById.set(z.id, z.code));

      setRows(calculerReporting(entries, budgetByLine, zoneById));
      setLoading(false);
    });
  }, [project, dateDebut, dateFin]);

  const totalDepenses = rows.reduce((s, r) => s + r.montant, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text-primary">{t.reporting.titre}</h1>
        <div className="flex items-center gap-4 print:hidden">
          <Link href="/budget" className="text-sm text-accent-blue hover:underline">
            {t.reporting.voirFinancialReport}
          </Link>
          <Pill
            onClick={() =>
              exporterCsv(
                "Reporting",
                [
                  t.common.date,
                  t.reporting.colPartCode,
                  t.reporting.colPartCCode,
                  t.reporting.colOurLineCode,
                  t.reporting.colJournal,
                  t.reporting.colNCompte,
                  t.common.libelle,
                  t.reporting.colNChqOv,
                  t.reporting.colZone,
                  t.reporting.colMontant,
                  t.reporting.colNPiece,
                ],
                rows.map((r) => [
                  r.date,
                  r.partCode,
                  r.partCCode,
                  r.ourLineCode,
                  r.journal,
                  r.compte,
                  r.libelle,
                  r.ref,
                  r.zone,
                  r.montant,
                  r.nPiece,
                ])
              )
            }
          >
            {t.common.exportExcel}
          </Pill>
          <Pill onClick={() => window.print()}>{t.common.exportPdf}</Pill>
          <Pill solid onClick={() => window.print()}>
            {t.common.imprimer}
          </Pill>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border-subtle bg-bg-card p-4 print:hidden">
        <FormField
          label={t.reporting.dateDebut}
          type="date"
          value={dateDebut}
          onChange={(e) => setDateDebut(e.target.value)}
        />
        <FormField
          label={t.reporting.dateFin}
          type="date"
          value={dateFin}
          onChange={(e) => setDateFin(e.target.value)}
        />
        <StatCard
          label={t.reporting.totalDepenses}
          value={totalDepenses.toLocaleString("fr-FR")}
          valueColor="amber"
        />
      </div>

      <div className="max-h-[65vh] overflow-auto rounded-xl border border-border-subtle print:max-h-none print:overflow-visible">
        <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
          <MiniTableHeader
            columns={[t.common.date, t.reporting.colPartCode, t.reporting.colPartCCode, t.reporting.colOurLineCode, t.reporting.colJournal, t.reporting.colNCompte, t.common.libelle, t.reporting.colNChqOv, t.reporting.colZone, t.reporting.colMontant, t.reporting.colNPiece]}
            align={["left", "left", "left", "left", "left", "left", "left", "left", "left", "right", "left"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-center text-text-secondary">
                  {t.common.chargement}
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-center text-text-secondary">
                  {t.reporting.aucuneDepense}
                </td>
              </tr>
            )}
            {rows.map((r, idx) => (
              <tr key={idx} className="text-text-primary">
                <td className="px-3 py-2">
                  {new Date(r.date).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-3 py-2">{r.partCode}</td>
                <td className="px-3 py-2">{r.partCCode}</td>
                <td className="px-3 py-2">{r.ourLineCode}</td>
                <td className="px-3 py-2">{r.journal}</td>
                <td className="px-3 py-2">{r.compte}</td>
                <td className="px-3 py-2">{r.libelle}</td>
                <td className="px-3 py-2">{r.ref}</td>
                <td className="px-3 py-2">{r.zone}</td>
                <td className="px-3 py-2 text-right">
                  {r.montant.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2">{r.nPiece}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-bg-card font-semibold text-text-primary">
              <tr>
                <td className="px-3 py-2" colSpan={9}>
                  {t.common.total}
                </td>
                <td className="px-3 py-2 text-right">
                  {totalDepenses.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
