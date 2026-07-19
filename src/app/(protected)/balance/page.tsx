"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { ChartOfAccount, JournalEntry } from "@/lib/types";

function firstOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type BalanceRow = {
  compte: string;
  libelle: string;
  totalDebit: number;
  totalCredit: number;
};

export default function BalancePage() {
  const { project } = useAuth();
  const [dateDebut, setDateDebut] = useState(firstOfMonthIso());
  const [dateFin, setDateFin] = useState(todayIso());
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!project) return;
    setLoading(true);

    Promise.all([
      supabase
        .from("journal_entries")
        .select("*")
        .eq("project_id", project.id)
        .gte("date_operation", dateDebut)
        .lte("date_operation", dateFin),
      supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("project_id", project.id),
    ]).then(([entriesRes, accountsRes]) => {
      const entries = (entriesRes.data as JournalEntry[]) ?? [];
      const accounts = (accountsRes.data as ChartOfAccount[]) ?? [];
      const libelleByCompte = new Map(accounts.map((a) => [a.ccompte, a.libelle]));

      const totals = new Map<string, { totalDebit: number; totalCredit: number }>();

      entries.forEach((e) => {
        if (e.compte_debit) {
          const cur = totals.get(e.compte_debit) ?? { totalDebit: 0, totalCredit: 0 };
          cur.totalDebit += e.montant_debit;
          totals.set(e.compte_debit, cur);
        }
        if (e.compte_credit) {
          const cur = totals.get(e.compte_credit) ?? { totalDebit: 0, totalCredit: 0 };
          cur.totalCredit += e.montant_credit;
          totals.set(e.compte_credit, cur);
        }
      });

      const result: BalanceRow[] = Array.from(totals.entries())
        .map(([compte, t]) => ({
          compte,
          libelle: libelleByCompte.get(compte) ?? "",
          totalDebit: t.totalDebit,
          totalCredit: t.totalCredit,
        }))
        .sort((a, b) => a.compte.localeCompare(b.compte));

      setRows(result);
      setLoading(false);
    });
  }, [project, dateDebut, dateFin]);

  const grandTotalDebit = rows.reduce((sum, r) => sum + r.totalDebit, 0);
  const grandTotalCredit = rows.reduce((sum, r) => sum + r.totalCredit, 0);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-100">Balance</h1>

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
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
              <th className="px-3 py-2 text-left">Compte</th>
              <th className="px-3 py-2 text-left">Libellé</th>
              <th className="px-3 py-2 text-right">Total Débit</th>
              <th className="px-3 py-2 text-right">Total Crédit</th>
              <th className="px-3 py-2 text-right">Solde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/40">
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                  Aucun mouvement sur cette période.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.compte} className="text-slate-200">
                <td className="px-3 py-2">{r.compte}</td>
                <td className="px-3 py-2">{r.libelle}</td>
                <td className="px-3 py-2 text-right">
                  {r.totalDebit.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.totalCredit.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {(r.totalDebit - r.totalCredit).toLocaleString("fr-FR")}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-slate-800 font-semibold text-slate-100">
              <tr>
                <td className="px-3 py-2" colSpan={2}>
                  TOTAUX
                </td>
                <td className="px-3 py-2 text-right">
                  {grandTotalDebit.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {grandTotalCredit.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {(grandTotalDebit - grandTotalCredit).toLocaleString("fr-FR")}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
