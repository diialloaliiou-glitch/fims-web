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

function veilleIso(dateIso: string) {
  const d = new Date(dateIso);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function GrandLivrePage() {
  const { project } = useAuth();
  const { t } = useLanguage();
  const [racineInput, setRacineInput] = useState("");
  const [racineValidee, setRacineValidee] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState(firstOfMonthIso());
  const [dateFin, setDateFin] = useState(todayIso());
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [soldeAnterieur, setSoldeAnterieur] = useState(0);
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

    const [periodeRes, anterieurRes] = await Promise.all([
      supabase
        .from("journal_entries")
        .select("*")
        .eq("project_id", project.id)
        .gte("date_operation", dateDebut)
        .lte("date_operation", dateFin)
        .order("date_operation", { ascending: true }),
      // Solde antérieur = somme de tous les mouvements du compte (meme
      // filtre par racine) survenus avant la date de debut choisie - pas
      // seulement une valeur affichee, un vrai calcul sur l'historique.
      supabase
        .from("journal_entries")
        .select("compte_debit, compte_credit, montant_debit, montant_credit")
        .eq("project_id", project.id)
        .lt("date_operation", dateDebut),
    ]);

    const filtered = ((periodeRes.data as JournalEntry[]) ?? []).filter(
      (en) =>
        (en.compte_debit ?? "").startsWith(racine) ||
        (en.compte_credit ?? "").startsWith(racine)
    );

    const anterieur = (
      (anterieurRes.data as
        | { compte_debit: string | null; compte_credit: string | null; montant_debit: number; montant_credit: number }[]
        | null) ?? []
    )
      .filter(
        (en) =>
          (en.compte_debit ?? "").startsWith(racine) ||
          (en.compte_credit ?? "").startsWith(racine)
      )
      .reduce((s, en) => s + en.montant_debit - en.montant_credit, 0);

    setEntries(filtered);
    setSoldeAnterieur(anterieur);
    setRacineValidee(racine);
    setLoading(false);
  }

  const soldeFinal =
    soldeAnterieur + entries.reduce((s, e) => s + e.montant_debit - e.montant_credit, 0);
  const totalDebit =
    (soldeAnterieur > 0 ? soldeAnterieur : 0) + entries.reduce((s, e) => s + e.montant_debit, 0);
  const totalCredit =
    (soldeAnterieur < 0 ? Math.abs(soldeAnterieur) : 0) +
    entries.reduce((s, e) => s + e.montant_credit, 0);

  let running = soldeAnterieur;

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
              let s = soldeAnterieur;
              const rows: (string | number | null)[][] = [
                [
                  new Date(veilleIso(dateDebut)).toLocaleDateString("fr-FR"),
                  "",
                  t.grandLivre.soldeAnterieur,
                  `${racineValidee ?? ""}...`,
                  "",
                  soldeAnterieur > 0 ? soldeAnterieur : 0,
                  soldeAnterieur < 0 ? Math.abs(soldeAnterieur) : 0,
                  soldeAnterieur,
                ],
              ];
              entries.forEach((e) => {
                s += e.montant_debit - e.montant_credit;
                rows.push([
                  new Date(e.date_operation).toLocaleDateString("fr-FR"),
                  e.n_piece,
                  e.libelle,
                  e.ref_fact_d,
                  e.n_ecriture_journal,
                  e.montant_debit,
                  e.montant_credit,
                  s,
                ]);
              });
              rows.push([
                "",
                "",
                t.grandLivre.soldeFinal,
                "",
                "",
                totalDebit,
                totalCredit,
                soldeFinal,
              ]);
              exporterCsv(
                "GrandLivre",
                [
                  t.common.date,
                  t.grandLivre.colPiece,
                  t.common.libelle,
                  t.grandLivre.colReference,
                  t.grandLivre.colNJournal,
                  t.common.debit,
                  t.common.credit,
                  t.grandLivre.colSoldeCumule,
                ],
                rows
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
              columns={[
                t.common.date,
                t.grandLivre.colPiece,
                t.common.libelle,
                t.grandLivre.colReference,
                t.grandLivre.colNJournal,
                t.common.debit,
                t.common.credit,
                t.grandLivre.colSoldeCumule,
              ]}
              align={["left", "left", "left", "left", "left", "right", "right", "right"]}
            />
            <tbody className="divide-y divide-border-subtle bg-bg-card/60">
              <tr className="text-text-primary">
                <td className="px-3 py-2">
                  {new Date(veilleIso(dateDebut)).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 font-semibold">{t.grandLivre.soldeAnterieur}</td>
                <td className="px-3 py-2">{racineValidee}...</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right">
                  {soldeAnterieur > 0 ? soldeAnterieur.toLocaleString("fr-FR") : ""}
                </td>
                <td className="px-3 py-2 text-right">
                  {soldeAnterieur < 0 ? Math.abs(soldeAnterieur).toLocaleString("fr-FR") : ""}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {soldeAnterieur.toLocaleString("fr-FR")}
                </td>
              </tr>

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
                    <td className="px-3 py-2">{e.libelle}</td>
                    <td className="px-3 py-2">{e.ref_fact_d}</td>
                    <td className="px-3 py-2">{e.n_ecriture_journal}</td>
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
            <tfoot className="bg-bg-card font-semibold text-text-primary">
              <tr>
                <td className="px-3 py-2" colSpan={2}></td>
                <td className="px-3 py-2">{t.grandLivre.soldeFinal}</td>
                <td className="px-3 py-2" colSpan={2}></td>
                <td className="px-3 py-2 text-right">{totalDebit.toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2 text-right">{totalCredit.toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2 text-right">{soldeFinal.toLocaleString("fr-FR")}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
