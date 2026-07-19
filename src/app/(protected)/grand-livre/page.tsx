"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { exporterCsv } from "@/lib/export-csv";
import type { ChartOfAccount, JournalEntry } from "@/lib/types";

function firstOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function GrandLivrePage() {
  const { project } = useAuth();
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [compte, setCompte] = useState("");
  const [dateDebut, setDateDebut] = useState(firstOfMonthIso());
  const [dateFin, setDateFin] = useState(todayIso());
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!project) return;
    supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("project_id", project.id)
      .order("compte")
      .then(({ data }) => setAccounts((data as ChartOfAccount[]) ?? []));
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

    if (compte) {
      query = query.or(`compte_debit.eq.${compte},compte_credit.eq.${compte}`);
    }

    query.then(({ data }) => {
      setEntries((data as JournalEntry[]) ?? []);
      setLoading(false);
    });
  }, [project, compte, dateDebut, dateFin]);

  let running = 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-fg-primary">Grand Livre</h1>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => {
              let s = 0;
              exporterCsv(
                "GrandLivre",
                ["Date", "Pièce", "Compte D", "Compte C", "Libellé", "Débit", "Crédit", "Solde cumulé"],
                entries.map((e) => {
                  s += e.montant_debit - e.montant_credit;
                  return [
                    new Date(e.date_operation).toLocaleDateString("fr-FR"),
                    e.n_piece,
                    e.compte_debit,
                    e.compte_credit,
                    e.libelle,
                    e.montant_debit,
                    e.montant_credit,
                    s,
                  ];
                })
              );
            }}
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
          <label className="mb-1 block text-sm text-fg-secondary">Compte</label>
          <select
            value={compte}
            onChange={(e) => setCompte(e.target.value)}
            className="rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
          >
            <option value="">Tous les comptes</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.ccompte}>
                {a.ccompte} - {a.libelle}
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
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Pièce</th>
              <th className="px-3 py-2 text-left">Compte D</th>
              <th className="px-3 py-2 text-left">Compte C</th>
              <th className="px-3 py-2 text-left">Libellé</th>
              <th className="px-3 py-2 text-right">Débit</th>
              <th className="px-3 py-2 text-right">Crédit</th>
              <th className="px-3 py-2 text-right">Solde cumulé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default bg-surface-1/60">
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-fg-muted">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-fg-muted">
                  Aucune écriture sur cette période.
                </td>
              </tr>
            )}
            {entries.map((e) => {
              running += e.montant_debit - e.montant_credit;
              return (
                <tr key={e.id} className="text-fg-primary">
                  <td className="px-3 py-2">
                    {new Date(e.date_operation).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-3 py-2">{e.n_piece}</td>
                  <td className="px-3 py-2">{e.compte_debit ?? ""}</td>
                  <td className="px-3 py-2">{e.compte_credit ?? ""}</td>
                  <td className="px-3 py-2">{e.libelle}</td>
                  <td className="px-3 py-2 text-right">
                    {e.montant_debit ? e.montant_debit.toLocaleString("fr-FR") : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {e.montant_credit ? e.montant_credit.toLocaleString("fr-FR") : ""}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {running.toLocaleString("fr-FR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
