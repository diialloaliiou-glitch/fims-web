"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
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

export default function GrandLivrePage() {
  const { project } = useAuth();
  const { t } = useLanguage();
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
        <h1 className="text-2xl font-semibold text-text-primary">{t.grandLivre.titre}</h1>
        <div className="flex gap-2 print:hidden">
          <Pill
            onClick={() => {
              let s = 0;
              exporterCsv(
                "GrandLivre",
                [t.common.date, t.grandLivre.colPiece, t.grandLivre.colCompteD, t.grandLivre.colCompteC, t.common.libelle, t.common.debit, t.common.credit, t.grandLivre.colSoldeCumule],
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
          >
            {t.common.exportExcel}
          </Pill>
          <Pill onClick={() => window.print()}>{t.common.exportPdf}</Pill>
          <Pill solid onClick={() => window.print()}>
            {t.common.imprimer}
          </Pill>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-border-subtle bg-bg-card p-4 print:hidden">
        <FormField label={t.common.compte}>
          <select
            value={compte}
            onChange={(e) => setCompte(e.target.value)}
            className={fieldControlClass}
          >
            <option value="">{t.grandLivre.tousLesComptes}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.ccompte}>
                {a.ccompte} - {a.libelle}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label={t.common.du}
          type="date"
          value={dateDebut}
          onChange={(e) => setDateDebut(e.target.value)}
        />
        <FormField
          label={t.common.au}
          type="date"
          value={dateFin}
          onChange={(e) => setDateFin(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-full text-sm">
          <MiniTableHeader
            columns={[t.common.date, t.grandLivre.colPiece, t.grandLivre.colCompteD, t.grandLivre.colCompteC, t.common.libelle, t.common.debit, t.common.credit, t.grandLivre.colSoldeCumule]}
            align={["left", "left", "left", "left", "left", "right", "right", "right"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-text-secondary">
                  {t.common.chargement}
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-text-secondary">
                  {t.grandLivre.aucuneEcriture}
                </td>
              </tr>
            )}
            {entries.map((e) => {
              running += e.montant_debit - e.montant_credit;
              return (
                <tr key={e.id} className="text-text-primary">
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
