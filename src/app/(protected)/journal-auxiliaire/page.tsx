"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { exporterCsv } from "@/lib/export-csv";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { Pill } from "@/components/ui/Pill";
import type { BankJournal, JournalEntry } from "@/lib/types";

function firstOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Reproduit Generer_Journal_Auxiliaire() du FIMS VBA d'origine : le
// journal auxiliaire est filtré par CODE DE JOURNAL (BQ, AC, OD...),
// pas par tiers — c'est un sous-journal par type de journal (ex:
// "journal auxiliaire de banque"), avec "*" pour voir tous les journaux.
export default function JournalAuxiliairePage() {
  const { project } = useAuth();
  const [journaux, setJournaux] = useState<BankJournal[]>([]);
  const [journal, setJournal] = useState("*");
  const [dateDebut, setDateDebut] = useState(firstOfMonthIso());
  const [dateFin, setDateFin] = useState(todayIso());
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!project) return;
    supabase
      .from("bank_journals")
      .select("*")
      .eq("organization_id", project.organization_id)
      .order("code")
      .then(({ data }) => setJournaux((data as BankJournal[]) ?? []));
  }, [project]);

  useEffect(() => {
    if (!project) return;
    setLoading(true);

    let query = supabase
      .from("journal_entries")
      .select("*")
      .eq("project_id", project.id)
      .gte("date_operation", dateDebut)
      .lte("date_operation", dateFin)
      .order("date_operation", { ascending: true });

    if (journal !== "*") {
      query = query.eq("journal", journal);
    }

    query.then(({ data }) => {
      setEntries((data as JournalEntry[]) ?? []);
      setLoading(false);
    });
  }, [project, journal, dateDebut, dateFin]);

  const totalDebit = entries.reduce((s, e) => s + e.montant_debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.montant_credit, 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">
          Journal Auxiliaire
        </h1>
        <div className="flex gap-2 print:hidden">
          <Pill
            onClick={() =>
              exporterCsv(
                "JournalAuxiliaire",
                ["N°E-J", "B-S-Line", "Référence", "Date", "D", "C", "Libellé", "M_Débit", "M_Crédit", "N°Pièce"],
                entries.map((e) => [
                  e.n_ecriture_journal,
                  e.b_s_line,
                  e.n_cheque_ov,
                  new Date(e.date_operation).toLocaleDateString("fr-FR"),
                  e.compte_debit,
                  e.compte_credit,
                  e.libelle,
                  e.montant_debit,
                  e.montant_credit,
                  e.n_piece,
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

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-border-subtle bg-bg-card p-4 print:hidden">
        <FormField label="Journal">
          <select
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            className={`min-w-[160px] ${fieldControlClass}`}
          >
            <option value="*">Tous les journaux (*)</option>
            {journaux.map((j) => (
              <option key={j.id} value={j.code}>
                {j.code}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Du"
          type="date"
          value={dateDebut}
          onChange={(e) => setDateDebut(e.target.value)}
        />
        <FormField
          label="Au"
          type="date"
          value={dateFin}
          onChange={(e) => setDateFin(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-full text-sm">
          <MiniTableHeader
            columns={["N°E-J", "B-S-Line", "Référence", "Date", "D", "C", "Libellé", "M_Débit", "M_Crédit", "N°Pièce"]}
            align={["left", "left", "left", "left", "left", "left", "left", "right", "right", "left"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-text-secondary">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-text-secondary">
                  Aucune écriture sur cette période.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="text-text-primary">
                <td className="px-3 py-2">{e.n_ecriture_journal}</td>
                <td className="px-3 py-2">{e.b_s_line}</td>
                <td className="px-3 py-2">{e.n_cheque_ov}</td>
                <td className="px-3 py-2">
                  {new Date(e.date_operation).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-3 py-2">{e.compte_debit}</td>
                <td className="px-3 py-2">{e.compte_credit}</td>
                <td className="px-3 py-2">{e.libelle}</td>
                <td className="px-3 py-2 text-right">
                  {e.montant_debit ? e.montant_debit.toLocaleString("fr-FR") : ""}
                </td>
                <td className="px-3 py-2 text-right">
                  {e.montant_credit ? e.montant_credit.toLocaleString("fr-FR") : ""}
                </td>
                <td className="px-3 py-2">{e.n_piece}</td>
              </tr>
            ))}
          </tbody>
          {entries.length > 0 && (
            <tfoot className="bg-bg-card font-semibold text-text-primary">
              <tr>
                <td className="px-3 py-2" colSpan={7}>
                  TOTAL
                </td>
                <td className="px-3 py-2 text-right">
                  {totalDebit.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {totalCredit.toLocaleString("fr-FR")}
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
