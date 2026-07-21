"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { exporterCsv } from "@/lib/export-csv";
import { FormField } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { Pill } from "@/components/ui/Pill";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { JournalEntry } from "@/lib/types";

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
  const [racineInput, setRacineInput] = useState("");
  const [racineValidee, setRacineValidee] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState(firstOfMonthIso());
  const [dateFin, setDateFin] = useState(todayIso());
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Reproduit GenererGrandLivre() du FIMS VBA d'origine : la racine de
  // compte est obligatoire, numerique, et d'au moins 3 chiffres. Le
  // filtrage est un "commence par" (Left(compte, longueur) = racine),
  // applique au compte debite comme au compte credite.
  async function handleGenerer(e: React.FormEvent) {
    e.preventDefault();
    const racine = racineInput.trim();

    if (!racine) {
      setErreur(t.grandLivre.erreurRacineVide);
      return;
    }
    if (!/^\d+$/.test(racine)) {
      setErreur(t.grandLivre.erreurRacineNonNumerique);
      return;
    }
    if (racine.length < 3) {
      setErreur(t.grandLivre.erreurRacineTropCourte);
      return;
    }

    if (!project) return;
    setErreur(null);
    setLoading(true);

    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("project_id", project.id)
      .gte("date_operation", dateDebut)
      .lte("date_operation", dateFin)
      .order("date_operation", { ascending: true });

    const filtered = ((data as JournalEntry[]) ?? []).filter(
      (en) =>
        (en.compte_debit ?? "").startsWith(racine) ||
        (en.compte_credit ?? "").startsWith(racine)
    );

    setEntries(filtered);
    setRacineValidee(racine);
    setLoading(false);
  }

  let running = 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">
          {racineValidee
            ? t.grandLivre.titreAvecRacine.replace("{racine}", racineValidee)
            : t.grandLivre.titre}
        </h1>
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

      <form
        onSubmit={handleGenerer}
        className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border-subtle bg-bg-card p-4 print:hidden"
      >
        <FormField
          label={t.grandLivre.racineCompte}
          required
          value={racineInput}
          onChange={(e) => setRacineInput(e.target.value)}
          placeholder={t.grandLivre.racineComptePlaceholder}
        />
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
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? t.common.chargement : t.grandLivre.generer}
        </PrimaryButton>
      </form>

      {erreur && <p className="mb-4 text-sm text-accent-red print:hidden">{erreur}</p>}

      {racineValidee && (
        <div className="max-h-[65vh] overflow-auto rounded-xl border border-border-subtle print:max-h-none print:overflow-visible">
          <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
            <MiniTableHeader
              columns={[t.common.date, t.grandLivre.colPiece, t.grandLivre.colCompteD, t.grandLivre.colCompteC, t.common.libelle, t.common.debit, t.common.credit, t.grandLivre.colSoldeCumule]}
              align={["left", "left", "left", "left", "left", "right", "right", "right"]}
            />
            <tbody className="divide-y divide-border-subtle bg-bg-card/60">
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
      )}
    </div>
  );
}
