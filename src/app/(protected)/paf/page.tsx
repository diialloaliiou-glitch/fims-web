"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { FormField } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { Pill } from "@/components/ui/Pill";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { BudgetLine, JournalEntry } from "@/lib/types";

// Reproduit CalculerSoldeBanqueProjet() du FIMS VBA d'origine (mod_FichePaiement) :
// solde de TOUS les mouvements TRESORERIE dont le compte (D ou C) commence
// par "5211" (le compte banque du PROJET, ex: 521100 "Banque projet
// BAMAKO" — distinct de 521200 "compte principal groupe" ou 522xxx
// "banques régionales"), sur TOUTE la période (pas de filtre de date/pièce :
// c'est le solde réel actuel, indépendant de la pièce consultée).
const PREFIXE_COMPTE_BANQUE_PROJET = "5211";

export default function FichePaiementPage() {
  const { profile, project, organization } = useAuth();

  const [options, setOptions] = useState<string[]>([]);
  const [numEJ, setNumEJ] = useState("");
  const [lignes, setLignes] = useState<JournalEntry[]>([]);
  const [budgetGlobal, setBudgetGlobal] = useState(0);
  const [soldeActuel, setSoldeActuel] = useState<number | null>(null);
  const [dernierNEJCompte, setDernierNEJCompte] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preparePar, setPreparePar] = useState("");
  const [approuvePar, setApprouvePar] = useState("");

  useEffect(() => {
    if (!project) return;
    supabase
      .from("journal_entries")
      .select("n_ecriture_journal")
      .eq("project_id", project.id)
      .eq("type_operation", "TRESORERIE")
      .then(({ data }) => {
        const unique = Array.from(
          new Set((data ?? []).map((r) => r.n_ecriture_journal).filter(Boolean))
        ) as string[];
        setOptions(unique.sort());
      });
  }, [project]);

  async function chargerFiche(nej: string) {
    setError(null);
    setLignes([]);
    setSoldeActuel(null);
    setDernierNEJCompte(null);
    if (!project || !nej.trim()) return;

    setLoading(true);

    const { data: lignesData } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("project_id", project.id)
      .eq("n_ecriture_journal", nej.trim())
      .eq("type_operation", "TRESORERIE")
      .order("id");

    const rows = (lignesData as JournalEntry[]) ?? [];

    if (rows.length === 0) {
      setLoading(false);
      setError(`Aucun règlement (TRESORERIE) trouvé pour l'écriture ${nej}.`);
      return;
    }

    setLignes(rows);

    const { data: budgetLinesData } = await supabase
      .from("budget_lines")
      .select("*")
      .eq("project_id", project.id);
    const total = ((budgetLinesData as BudgetLine[]) ?? []).reduce(
      (sum, l) => sum + (l.total_cost ?? 0),
      0
    );
    setBudgetGlobal(total);

    const { data: allTreso } = await supabase
      .from("journal_entries")
      .select("compte_debit, compte_credit, montant_debit, montant_credit, n_ecriture_journal, date_heure_saisie")
      .eq("project_id", project.id)
      .eq("type_operation", "TRESORERIE");

    let solde = 0;
    let dernier: { nej: string; date: string } | null = null;

    (allTreso ?? []).forEach((e) => {
      const surCompteD = (e.compte_debit ?? "").startsWith(PREFIXE_COMPTE_BANQUE_PROJET);
      const surCompteC = (e.compte_credit ?? "").startsWith(PREFIXE_COMPTE_BANQUE_PROJET);
      if (surCompteD) solde += e.montant_debit;
      if (surCompteC) solde -= e.montant_credit;

      if (surCompteD || surCompteC) {
        if (!dernier || e.date_heure_saisie >= dernier.date) {
          dernier = { nej: e.n_ecriture_journal ?? "", date: e.date_heure_saisie };
        }
      }
    });

    setSoldeActuel(solde);
    if (dernier && (dernier as { nej: string }).nej.toUpperCase() !== nej.trim().toUpperCase()) {
      setDernierNEJCompte((dernier as { nej: string }).nej);
    }

    setLoading(false);
  }

  // "This request" = SUM(Credit) des lignes de la pièce, comme H18 =
  // SUM(FICHEPAIE[Credit]) dans Excel (le mouvement côté banque).
  const montantDemande = lignes.reduce((sum, l) => sum + l.montant_credit, 0);
  // "Currently available" = H14+H40 (solde actuel + cette demande, pour
  // reconstituer le solde AVANT cette demande) ; "RESTING balance" = H14
  // (le solde actuel réel, après cette demande).
  const soldeDisponible = soldeActuel !== null ? soldeActuel + montantDemande : null;
  const soldeRestant = soldeActuel;
  const premiere = lignes[0];
  const estPieceAnterieure = dernierNEJCompte !== null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary print:hidden">
        Fiche de Paiement
      </h1>

      <div className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        <div className="w-56">
          <FormField
            label="N° Écriture (ex: BQ-0019)"
            list="nej-list"
            value={numEJ}
            onChange={(e) => setNumEJ(e.target.value)}
          />
          <datalist id="nej-list">
            {options.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>
        <PrimaryButton onClick={() => chargerFiche(numEJ)} disabled={loading}>
          {loading ? "Chargement..." : "Charger"}
        </PrimaryButton>
        {lignes.length > 0 && !estPieceAnterieure && (
          <Pill onClick={() => window.print()}>Imprimer</Pill>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-accent-red print:hidden">{error}</p>}

      {premiere && (
        <div className="rounded-xl border border-border-subtle bg-bg-card p-6 print:border-black print:bg-white print:text-black">
          <div className="mb-4 flex items-start justify-between">
            <p className="text-xl font-bold text-text-primary print:text-black">
              PAYMENT AUTHORIZATION FORM
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <p>
              <span className="text-text-secondary">Item No. : </span>
              <span className="font-bold text-accent-teal print:text-black">{numEJ}</span>
            </p>
            <p>
              <span className="text-text-secondary">Date : </span>
              {new Date(premiere.date_operation).toLocaleDateString("fr-FR")}
            </p>
            <p>
              <span className="text-text-secondary">N°chq/ov/bcs : </span>
              {premiere.n_cheque_ov}
            </p>
            <p>
              <span className="text-text-secondary">Project ID : </span>
              {project?.code_projet}
            </p>
            <p className="col-span-2">
              <span className="text-text-secondary">Beneficiary : </span>
              {premiere.tiers}
            </p>
            <p className="col-span-2">
              <span className="text-text-secondary">Organization : </span>
              {organization?.nom}
            </p>
          </div>

          {estPieceAnterieure ? (
            <div className="mb-6 rounded-md border border-accent-red bg-accent-red/10 px-4 py-3 text-sm font-semibold text-accent-red">
              PIÈCE ANTÉRIEURE — solde non calculable. Une opération plus
              récente existe sur ce compte ({dernierNEJCompte}). Impression
              non disponible pour {numEJ}.
            </div>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border border-border-subtle p-4 text-sm print:border-black">
                <p>
                  Approved Budget :{" "}
                  <span className="font-semibold">
                    {Math.round(budgetGlobal).toLocaleString("fr-FR")}
                  </span>
                </p>
                <p>
                  Currently available :{" "}
                  <span className="font-semibold">
                    {soldeDisponible !== null
                      ? Math.round(soldeDisponible).toLocaleString("fr-FR")
                      : "—"}
                  </span>
                </p>
                <p>
                  This request :{" "}
                  <span className="font-semibold">
                    {Math.round(montantDemande).toLocaleString("fr-FR")}
                  </span>
                </p>
                <p>
                  RESTING balance :{" "}
                  <span className="font-semibold">
                    {soldeRestant !== null
                      ? Math.round(soldeRestant).toLocaleString("fr-FR")
                      : "—"}
                  </span>
                </p>
              </div>

              <table className="mb-6 min-w-full text-sm">
                <MiniTableHeader
                  columns={["Budget code", "Account No.", "Libellé", "Debit", "Credit"]}
                  align={["left", "left", "left", "right", "right"]}
                />
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.id} className="border-b border-border-subtle print:border-gray-300">
                      <td className="py-1">{l.b_s_line}</td>
                      <td className="py-1">
                        {l.montant_debit > 0 ? l.compte_debit : l.compte_credit}
                      </td>
                      <td className="py-1">{l.libelle}</td>
                      <td className="py-1 text-right">
                        {l.montant_debit ? l.montant_debit.toLocaleString("fr-FR") : ""}
                      </td>
                      <td className="py-1 text-right">
                        {l.montant_credit ? l.montant_credit.toLocaleString("fr-FR") : ""}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-1" colSpan={3}>
                      TOTALS
                    </td>
                    <td className="py-1 text-right">
                      {lignes
                        .reduce((s, l) => s + l.montant_debit, 0)
                        .toLocaleString("fr-FR")}
                    </td>
                    <td className="py-1 text-right">
                      {lignes
                        .reduce((s, l) => s + l.montant_credit, 0)
                        .toLocaleString("fr-FR")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="mb-1 text-text-secondary print:text-black">
                Checked by : Administrative &amp; Financial Manager
              </p>
              <input
                type="text"
                value={preparePar}
                onChange={(e) => setPreparePar(e.target.value)}
                placeholder="Nom"
                className="w-full rounded-md border border-border-subtle bg-bg-card px-3 py-2 text-text-primary print:border-b print:border-black print:bg-transparent print:text-black"
              />
              <p className="mt-1 text-xs text-text-secondary print:text-black">Date :</p>
              <p className="mt-1 text-xs text-text-secondary print:text-black">
                By signing, you certify that the entries made are correct.
              </p>
            </div>
            <div>
              <p className="mb-1 text-text-secondary print:text-black">
                Approved by : Program Coordinator/President
              </p>
              <input
                type="text"
                value={approuvePar}
                onChange={(e) => setApprouvePar(e.target.value)}
                placeholder="Nom"
                className="w-full rounded-md border border-border-subtle bg-bg-card px-3 py-2 text-text-primary print:border-b print:border-black print:bg-transparent print:text-black"
              />
              <p className="mt-1 text-xs text-text-secondary print:text-black">Date :</p>
              <p className="mt-1 text-xs text-text-secondary print:text-black">
                By signing, you authorise the expenditure for the project.
              </p>
            </div>
          </div>

          <p className="mt-6 text-xs text-text-secondary print:text-black">
            Seized by : {premiere.utilisateur}
          </p>
        </div>
      )}
    </div>
  );
}
