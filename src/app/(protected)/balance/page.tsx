"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { exporterCsv } from "@/lib/export-csv";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { Pill } from "@/components/ui/Pill";
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
  soldeOuverture: number;
  debit: number;
  credit: number;
  soldeDebiteur: number;
  soldeCrediteur: number;
};

// Reproduit GenererBalance() / GetCleBalance() du FIMS VBA d'origine :
// mode GENERAL (regroupe par les 6 premiers chiffres du compte) ou
// AUXILIAIRE (filtre sur un prefixe de compte tiers, ex: 40, 401),
// avec un vrai solde d'ouverture (mouvements avant la date de debut).
function calculerBalance(
  entries: JournalEntry[],
  libelleByCompte: Map<string, string>,
  mode: "GENERAL" | "AUXILIAIRE",
  filtreAux: string,
  dateDebut: string,
  dateFin: string
): BalanceRow[] {
  function cle(compte: string | null): string | null {
    if (!compte) return null;
    const c = compte.trim();
    if (!c) return null;
    if (mode === "AUXILIAIRE") {
      return c.startsWith(filtreAux) ? c : null;
    }
    return c.length >= 6 ? c.slice(0, 6) : c;
  }

  const openDebit = new Map<string, number>();
  const openCredit = new Map<string, number>();
  const perDebit = new Map<string, number>();
  const perCredit = new Map<string, number>();
  const add = (m: Map<string, number>, k: string, v: number) =>
    m.set(k, (m.get(k) ?? 0) + v);

  entries.forEach((e) => {
    const avant = e.date_operation < dateDebut;
    const dansPeriode = e.date_operation >= dateDebut && e.date_operation <= dateFin;
    if (!avant && !dansPeriode) return;

    const cD = cle(e.compte_debit);
    const cC = cle(e.compte_credit);

    if (cD) add(avant ? openDebit : perDebit, cD, e.montant_debit);
    if (cC) add(avant ? openCredit : perCredit, cC, e.montant_credit);
  });

  const keys = new Set([...perDebit.keys(), ...perCredit.keys()]);

  return Array.from(keys)
    .map((k) => {
      const od = openDebit.get(k) ?? 0;
      const oc = openCredit.get(k) ?? 0;
      const d = perDebit.get(k) ?? 0;
      const c = perCredit.get(k) ?? 0;
      const soldeOuverture = od - oc;
      const soldeFinal = soldeOuverture + d - c;
      return {
        compte: k,
        libelle: libelleByCompte.get(k) ?? "",
        soldeOuverture,
        debit: d,
        credit: c,
        soldeDebiteur: soldeFinal > 0 ? soldeFinal : 0,
        soldeCrediteur: soldeFinal < 0 ? Math.abs(soldeFinal) : 0,
      };
    })
    .sort((a, b) => a.compte.localeCompare(b.compte));
}

export default function BalancePage() {
  const { project } = useAuth();
  const [mode, setMode] = useState<"GENERAL" | "AUXILIAIRE">("GENERAL");
  const [filtreAux, setFiltreAux] = useState("40");
  const [dateDebut, setDateDebut] = useState(firstOfMonthIso());
  const [dateFin, setDateFin] = useState(todayIso());
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!project) return;
    setLoading(true);

    Promise.all([
      supabase.from("journal_entries").select("*").eq("project_id", project.id),
      supabase.from("chart_of_accounts").select("*").eq("project_id", project.id),
    ]).then(([entriesRes, accountsRes]) => {
      setEntries((entriesRes.data as JournalEntry[]) ?? []);
      setAccounts((accountsRes.data as ChartOfAccount[]) ?? []);
      setLoading(false);
    });
  }, [project]);

  const libelleByCompte = new Map(accounts.map((a) => [a.ccompte, a.libelle]));
  const rows =
    mode === "AUXILIAIRE" && !/^\d{2,6}$/.test(filtreAux)
      ? []
      : calculerBalance(entries, libelleByCompte, mode, filtreAux, dateDebut, dateFin);

  const totals = rows.reduce(
    (acc, r) => ({
      soldeOuverture: acc.soldeOuverture + r.soldeOuverture,
      debit: acc.debit + r.debit,
      credit: acc.credit + r.credit,
      soldeDebiteur: acc.soldeDebiteur + r.soldeDebiteur,
      soldeCrediteur: acc.soldeCrediteur + r.soldeCrediteur,
    }),
    { soldeOuverture: 0, debit: 0, credit: 0, soldeDebiteur: 0, soldeCrediteur: 0 }
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Balance</h1>
        <div className="flex gap-2 print:hidden">
          <Pill
            onClick={() =>
              exporterCsv(
                "Balance",
                [
                  "N°Compte",
                  "Intitulé",
                  "Solde d'ouverture",
                  "Débit",
                  "Crédit",
                  "Solde débiteur",
                  "Solde créditeur",
                ],
                rows.map((r) => [
                  r.compte,
                  r.libelle,
                  r.soldeOuverture,
                  r.debit,
                  r.credit,
                  r.soldeDebiteur,
                  r.soldeCrediteur,
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

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border-subtle bg-bg-card p-4 print:hidden">
        <FormField label="Type de balance">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "GENERAL" | "AUXILIAIRE")}
            className={fieldControlClass}
          >
            <option value="GENERAL">Balance générale</option>
            <option value="AUXILIAIRE">Balance auxiliaire</option>
          </select>
        </FormField>
        {mode === "AUXILIAIRE" && (
          <FormField
            label="Préfixe compte tiers (ex: 40, 401)"
            value={filtreAux}
            onChange={(e) => setFiltreAux(e.target.value)}
          />
        )}
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
            columns={["N°Compte", "Intitulé de compte", "Solde d'ouverture", "Débit", "Crédit", "Solde débiteur", "Solde créditeur"]}
            align={["left", "left", "right", "right", "right", "right", "right"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-text-secondary">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-text-secondary">
                  Aucun mouvement sur cette période.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.compte} className="text-text-primary">
                <td className="px-3 py-2">{r.compte}</td>
                <td className="px-3 py-2">{r.libelle}</td>
                <td className="px-3 py-2 text-right">
                  {r.soldeOuverture.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.debit.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.credit.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.soldeDebiteur ? r.soldeDebiteur.toLocaleString("fr-FR") : ""}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.soldeCrediteur ? r.soldeCrediteur.toLocaleString("fr-FR") : ""}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-bg-card font-semibold text-text-primary">
              <tr>
                <td className="px-3 py-2" colSpan={2}>
                  TOTAL
                </td>
                <td className="px-3 py-2 text-right">
                  {totals.soldeOuverture.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {totals.debit.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {totals.credit.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {totals.soldeDebiteur.toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right">
                  {totals.soldeCrediteur.toLocaleString("fr-FR")}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
