"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { BudgetLine, JournalEntry } from "@/lib/types";

export default function FichePaiementPage() {
  const { profile, project, organization } = useAuth();

  const [options, setOptions] = useState<string[]>([]);
  const [numEJ, setNumEJ] = useState("");
  const [lignes, setLignes] = useState<JournalEntry[]>([]);
  const [budgetGlobal, setBudgetGlobal] = useState(0);
  const [soldeBanque, setSoldeBanque] = useState<number | null>(null);
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
    setSoldeBanque(null);
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

    const compteBanque =
      rows
        .map((r) => r.compte_debit ?? r.compte_credit ?? "")
        .find((c) => c.startsWith("5")) ?? null;

    const { data: budgetLinesData } = await supabase
      .from("budget_lines")
      .select("*")
      .eq("project_id", project.id);
    const total = ((budgetLinesData as BudgetLine[]) ?? []).reduce(
      (sum, l) => sum + (l.total_cost ?? 0),
      0
    );
    setBudgetGlobal(total);

    if (compteBanque) {
      const { data: allTreso } = await supabase
        .from("journal_entries")
        .select("compte_debit, compte_credit, montant_debit, montant_credit, n_ecriture_journal, date_heure_saisie")
        .eq("project_id", project.id)
        .eq("type_operation", "TRESORERIE");

      let solde = 0;
      let dernier: { nej: string; date: string } | null = null;

      (allTreso ?? []).forEach((e) => {
        if (e.compte_debit === compteBanque) solde += e.montant_debit;
        if (e.compte_credit === compteBanque) solde -= e.montant_credit;

        if (e.compte_debit === compteBanque || e.compte_credit === compteBanque) {
          if (!dernier || e.date_heure_saisie > dernier.date) {
            dernier = { nej: e.n_ecriture_journal ?? "", date: e.date_heure_saisie };
          }
        }
      });

      setSoldeBanque(solde);
      if (dernier && (dernier as { nej: string }).nej.toUpperCase() !== nej.trim().toUpperCase()) {
        setDernierNEJCompte((dernier as { nej: string }).nej);
      }
    }

    setLoading(false);
  }

  const montantDemande = lignes.reduce((sum, l) => sum + l.montant_debit, 0);
  const soldeRestant = soldeBanque !== null ? soldeBanque - montantDemande : null;
  const premiere = lignes[0];
  const estPieceAnterieure = dernierNEJCompte !== null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-fg-primary print:hidden">
        Fiche de Paiement
      </h1>

      <div className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <label className="mb-1 block text-sm text-fg-secondary">
            N° Écriture (ex: BQ-0019)
          </label>
          <input
            list="nej-list"
            value={numEJ}
            onChange={(e) => setNumEJ(e.target.value)}
            className="w-56 rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
          />
          <datalist id="nej-list">
            {options.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>
        <button
          onClick={() => chargerFiche(numEJ)}
          disabled={loading}
          className="rounded-md bg-accent-green px-5 py-2 font-medium text-on-accent hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Chargement..." : "Charger"}
        </button>
        {lignes.length > 0 && !estPieceAnterieure && (
          <button
            onClick={() => window.print()}
            className="rounded-md border border-border-default px-5 py-2 text-fg-secondary hover:bg-surface-2"
          >
            Imprimer
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-danger print:hidden">{error}</p>}

      {estPieceAnterieure && (
        <div className="mb-4 rounded-md border border-danger bg-danger-bg px-4 py-3 text-sm text-danger">
          Pièce antérieure — le solde ne peut pas être calculé de façon fiable.
          Une opération plus récente existe sur ce compte : {dernierNEJCompte}.
          Impression indisponible.
        </div>
      )}

      {premiere && (
        <div className="rounded-xl border border-border-default bg-surface-1 p-6 print:border-black print:bg-white print:text-black">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-sm text-fg-muted print:text-black">
                Item No.
              </p>
              <p className="text-lg font-bold text-accent-green print:text-black">
                {numEJ}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-fg-primary print:text-black">
                PAYMENT AUTHORIZATION FORM
              </p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <p>
              <span className="text-fg-muted">N°/Chq/OV/Bcs : </span>
              {premiere.n_cheque_ov}
            </p>
            <p>
              <span className="text-fg-muted">Date : </span>
              {new Date(premiere.date_operation).toLocaleDateString("fr-FR")}
            </p>
            <p>
              <span className="text-fg-muted">Beneficiary : </span>
              {premiere.tiers}
            </p>
            <p>
              <span className="text-fg-muted">Project ID : </span>
              {project?.code_projet}
            </p>
            <p>
              <span className="text-fg-muted">Organization : </span>
              {organization?.nom}
            </p>
            <p>
              <span className="text-fg-muted">Seized by : </span>
              {premiere.utilisateur}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border border-border-default p-4 text-sm print:border-black">
            <p>
              Approved Budget :{" "}
              <span className="font-semibold">
                {Math.round(budgetGlobal).toLocaleString("fr-FR")}
              </span>
            </p>
            <p>
              Currently available :{" "}
              <span className="font-semibold">
                {soldeBanque !== null
                  ? Math.round(soldeBanque).toLocaleString("fr-FR")
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
            <thead>
              <tr className="border-b border-border-default text-left text-fg-muted print:border-black print:text-black">
                <th className="py-1">Budget code</th>
                <th className="py-1">Account No.</th>
                <th className="py-1">Libellé</th>
                <th className="py-1 text-right">Debit</th>
                <th className="py-1 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-b border-border-default print:border-gray-300">
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

          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="mb-1 text-fg-muted print:text-black">
                Prepared by : Administrative &amp; Financial Manager
              </p>
              <input
                type="text"
                value={preparePar}
                onChange={(e) => setPreparePar(e.target.value)}
                placeholder="Nom"
                className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary print:border-b print:border-black print:bg-transparent print:text-black"
              />
              <p className="mt-1 text-xs text-fg-muted print:text-black">Date :</p>
            </div>
            <div>
              <p className="mb-1 text-fg-muted print:text-black">
                Approved by : Program Coordinator/President
              </p>
              <input
                type="text"
                value={approuvePar}
                onChange={(e) => setApprouvePar(e.target.value)}
                placeholder="Nom"
                className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary print:border-b print:border-black print:bg-transparent print:text-black"
              />
              <p className="mt-1 text-xs text-fg-muted print:text-black">Date :</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
