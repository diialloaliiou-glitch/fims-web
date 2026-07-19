"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
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
      <h1 className="mb-6 text-2xl font-semibold text-slate-100">
        Journal Auxiliaire
      </h1>

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Journal</label>
          <select
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            className="min-w-[160px] rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
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
          <label className="mb-1 block text-sm text-slate-300">Du</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Au</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800 text-slate-300">
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
          <tbody className="divide-y divide-slate-800 bg-slate-900/40">
            {loading && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-slate-400">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-slate-400">
                  Aucune écriture sur cette période.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="text-slate-200">
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
            <tfoot className="bg-slate-800 font-semibold text-slate-100">
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
