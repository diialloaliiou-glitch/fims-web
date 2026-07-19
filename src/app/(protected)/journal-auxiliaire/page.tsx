"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { exporterCsv } from "@/lib/export-csv";
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
        <h1 className="text-2xl font-semibold text-fg-primary">
          Journal Auxiliaire
        </h1>
        <div className="flex gap-2 print:hidden">
          <button
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
            className="rounded-md border border-border-default px-4 py-2 text-sm text-fg-secondary hover:bg-surface-2"
          >
            Export Excel
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-md border border-border-default px-4 py-2 text-sm text-fg-secondary hover:bg-surface-2"
          >
            Export PDF
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-md bg-accent-blue px-4 py-2 text-sm text-on-accent hover:opacity-90"
          >
            Imprimer
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-border-default bg-surface-1 p-4 print:hidden">
        <div>
          <label className="mb-1 block text-sm text-fg-secondary">Journal</label>
          <select
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            className="min-w-[160px] rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
          >
            <option value="*">Tous les journaux (*)</option>
            {journaux.map((j) => (
              <option key={j.id} value={j.code}>
                {j.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-fg-secondary">Du</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-fg-secondary">Au</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-default">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-2 text-fg-secondary">
            <tr>
              <th className="px-3 py-2 text-left">N°E-J</th>
              <th className="px-3 py-2 text-left">B-S-Line</th>
              <th className="px-3 py-2 text-left">Référence</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">D</th>
              <th className="px-3 py-2 text-left">C</th>
              <th className="px-3 py-2 text-left">Libellé</th>
              <th className="px-3 py-2 text-right">M_Débit</th>
              <th className="px-3 py-2 text-right">M_Crédit</th>
              <th className="px-3 py-2 text-left">N°Pièce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default bg-surface-1/60">
            {loading && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-fg-muted">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-fg-muted">
                  Aucune écriture sur cette période.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="text-fg-primary">
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
            <tfoot className="bg-surface-2 font-semibold text-fg-primary">
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
