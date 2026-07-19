"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { periodeCouranteFermee } from "@/lib/period-closure";
import type { ChartOfAccount, ThirdParty, Zone } from "@/lib/types";

const JOURNAUX = ["AC", "BQ", "OD", "SA"];
const TYPES_OPERATION = [
  "AVANCE et REGU",
  "PRISE EN CHARGE",
  "REGLEMENT",
  "REVERSEMENT",
  "TRESORERIE",
];

type Ligne = {
  id: number;
  compte: string;
  sens: "debit" | "credit";
  libelle: string;
  montant: number;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function nextSequence(
  projectId: string,
  column: "n_ecriture_journal" | "n_piece",
  prefix: string
) {
  const { data } = await supabase
    .from("journal_entries")
    .select(column)
    .eq("project_id", projectId)
    .like(column, `${prefix}-%`);

  let max = 0;
  (data ?? []).forEach((row: Record<string, string | null>) => {
    const val = row[column];
    if (!val) return;
    const num = parseInt(val.split("-").pop() ?? "0", 10);
    if (!isNaN(num) && num > max) max = num;
  });

  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

let ligneIdCounter = 1;

export default function SaisiePage() {
  const { profile, project } = useAuth();

  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  const [dateOperation, setDateOperation] = useState(todayIso());
  const [journal, setJournal] = useState("BQ");
  const [nEcritureJournal, setNEcritureJournal] = useState("");
  const [typeOperation, setTypeOperation] = useState(TYPES_OPERATION[0]);
  const [bSLine, setBSLine] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [tiers, setTiers] = useState("");
  const [refFactD, setRefFactD] = useState("");
  const [nChequeOv, setNChequeOv] = useState("");
  const [nPiece, setNPiece] = useState("");

  const [compte, setCompte] = useState("");
  const [sens, setSens] = useState<"debit" | "credit">("debit");
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");

  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;

    supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("project_id", project.id)
      .order("compte")
      .then(({ data }) => setAccounts((data as ChartOfAccount[]) ?? []));

    supabase
      .from("third_parties")
      .select("*")
      .eq("project_id", project.id)
      .then(({ data }) => setThirdParties((data as ThirdParty[]) ?? []));

    supabase
      .from("zones")
      .select("*")
      .eq("organization_id", project.organization_id)
      .order("code")
      .then(({ data }) => setZones((data as Zone[]) ?? []));

    nextSequence(project.id, "n_piece", "PC").then(setNPiece);
  }, [project]);

  useEffect(() => {
    if (!project) return;
    nextSequence(project.id, "n_ecriture_journal", journal).then(setNEcritureJournal);
  }, [project, journal]);

  const totalDebit = lignes
    .filter((l) => l.sens === "debit")
    .reduce((s, l) => s + l.montant, 0);
  const totalCredit = lignes
    .filter((l) => l.sens === "credit")
    .reduce((s, l) => s + l.montant, 0);

  function afficherNotice(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  }

  function ajouterLigne() {
    setError(null);
    if (!compte.trim()) {
      setError("Le N° de compte est obligatoire.");
      return;
    }
    const montantNum = parseFloat(montant);
    if (!montantNum || montantNum <= 0) {
      setError("Le montant doit être supérieur à zéro.");
      return;
    }
    if (!libelle.trim()) {
      setError("Le libellé est obligatoire.");
      return;
    }

    setLignes([
      ...lignes,
      { id: ligneIdCounter++, compte: compte.trim(), sens, libelle: libelle.trim(), montant: montantNum },
    ]);
    setCompte("");
    setMontant("");
  }

  function annulerLigne() {
    setCompte("");
    setMontant("");
    setSens("debit");
    setError(null);
  }

  function supprimerLigne(id: number) {
    setLignes(lignes.filter((l) => l.id !== id));
  }

  function genererLeReglement() {
    const ecart = totalDebit - totalCredit;
    if (ecart === 0) {
      afficherNotice("Les lignes sont déjà équilibrées.");
      return;
    }
    const compteTresorerie = accounts.find((a) => a.ccompte.startsWith("521"))?.ccompte ?? "521100";
    const compteDefaut = accounts.find((a) => a.ccompte.startsWith("401"))?.ccompte ?? "401100";
    const compteReglement =
      typeOperation === "TRESORERIE" || typeOperation === "REGLEMENT"
        ? compteTresorerie
        : compteDefaut;

    setLignes([
      ...lignes,
      {
        id: ligneIdCounter++,
        compte: compteReglement,
        sens: ecart > 0 ? "credit" : "debit",
        libelle: libelle.trim() || "Règlement",
        montant: Math.abs(ecart),
      },
    ]);
  }

  async function handleValider() {
    setError(null);
    setSuccess(null);

    if (lignes.length < 2) {
      setError("Ajoute au moins 2 lignes (une au débit, une au crédit) avant de valider.");
      return;
    }
    if (totalDebit !== totalCredit) {
      setError(
        `Le total débit (${totalDebit.toLocaleString("fr-FR")}) doit être égal au total crédit (${totalCredit.toLocaleString("fr-FR")}).`
      );
      return;
    }
    if (!project || !profile) {
      setError("Projet ou profil introuvable.");
      return;
    }

    const blocageCloture = await periodeCouranteFermee(project.id);
    if (blocageCloture) {
      setError(blocageCloture);
      return;
    }

    setSubmitting(true);

    const nej = await nextSequence(project.id, "n_ecriture_journal", journal);

    const common = {
      organization_id: profile.organization_id,
      project_id: project.id,
      date_operation: dateOperation,
      type_operation: typeOperation,
      journal,
      n_ecriture_journal: nej,
      n_piece: nPiece || null,
      b_s_line: bSLine || null,
      zone_id: zoneId ? parseInt(zoneId, 10) : null,
      tiers: tiers || null,
      ref_fact_d: refFactD || null,
      n_cheque_ov: nChequeOv || null,
      date_heure_saisie: new Date().toISOString(),
      utilisateur: profile.nom_utilisateur,
      created_at: new Date().toISOString(),
    };

    const rows = lignes.map((l) => ({
      ...common,
      compte_debit: l.sens === "debit" ? l.compte : null,
      compte_credit: l.sens === "credit" ? l.compte : null,
      montant_debit: l.sens === "debit" ? l.montant : 0,
      montant_credit: l.sens === "credit" ? l.montant : 0,
      libelle: l.libelle,
    }));

    const { error: insertError } = await supabase.from("journal_entries").insert(rows);

    setSubmitting(false);

    if (insertError) {
      setError(`Erreur d'enregistrement : ${insertError.message}`);
      return;
    }

    setSuccess(`Écriture ${nej} enregistrée (${rows.length} lignes).`);
    setLignes([]);
    setCompte("");
    setMontant("");
    setLibelle("");
    setTiers("");
    setRefFactD("");
    setNChequeOv("");
    setBSLine("");
    nextSequence(project.id, "n_piece", "PC").then(setNPiece);
    nextSequence(project.id, "n_ecriture_journal", journal).then(setNEcritureJournal);
  }

  return (
    <div className="flex gap-6">
      <div className="hidden w-32 shrink-0 flex-col gap-3 sm:flex">
        <Link
          href="/lettrage"
          className="rounded-full bg-surface-2 px-4 py-2 text-center text-sm text-fg-secondary hover:bg-surface-1"
        >
          Lettrage
        </Link>
        <Link
          href="/lettrage"
          className="rounded-full bg-surface-2 px-4 py-2 text-center text-sm text-fg-secondary hover:bg-surface-1"
        >
          Délettrage
        </Link>
      </div>

      <div className="flex-1">
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-sm text-fg-muted">
            <span className="hidden sm:inline">DATE COMPTABLE : </span>
            {new Date().toLocaleString("fr-FR")}
          </p>
          <p className="text-center text-sm font-medium text-fg-secondary">
            Financial Information Management System
          </p>
          <button
            onClick={() => afficherNotice("Journal intermédiaire : fonctionnalité à venir.")}
            className="rounded-full bg-surface-2 px-4 py-1.5 text-sm text-fg-secondary hover:bg-surface-1"
          >
            Accéder au journal intermédiaire
          </button>
        </div>

        <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-border-default bg-surface-2 py-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            className="h-8 w-8 text-accent-green"
          >
            <path d="M7 18a4 4 0 0 1-1-7.87A5.5 5.5 0 0 1 16.9 8.1 4.5 4.5 0 0 1 17 18Z" />
            <path d="M12 12v5m0-5-2 2m2-2 2 2" />
          </svg>
          <p className="text-xs text-fg-muted">N° JOURNAL</p>
          <p className="text-lg font-bold text-accent-green">{nEcritureJournal || "—"}</p>
        </div>

        {notice && (
          <p className="mb-4 rounded-md bg-surface-2 px-4 py-2 text-sm text-warning">
            {notice}
          </p>
        )}

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg-secondary">
              DATE DE LA PIÈCE*
            </label>
            <input
              type="date"
              value={dateOperation}
              onChange={(e) => setDateOperation(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg-secondary">
              N°PIÈCE
            </label>
            <input
              type="text"
              value={nPiece}
              onChange={(e) => setNPiece(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg-secondary">
              TYPE D&apos;OPÉRATION *
            </label>
            <select
              value={typeOperation}
              onChange={(e) => setTypeOperation(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            >
              {TYPES_OPERATION.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg-secondary">
              JOURNAL *
            </label>
            <select
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            >
              {JOURNAUX.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg-secondary">
              B-S-LINE
            </label>
            <input
              type="text"
              value={bSLine}
              onChange={(e) => setBSLine(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg-secondary">
              ZONE *
            </label>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            >
              <option value="">—</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg-secondary">
              TIERS *
            </label>
            <input
              list="tiers-list"
              type="text"
              value={tiers}
              onChange={(e) => setTiers(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
            <datalist id="tiers-list">
              {thirdParties.map((t) => (
                <option key={t.id} value={t.nom_tiers} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg-secondary">
              N° COMPTE *
            </label>
            <input
              list="comptes-list"
              type="text"
              value={compte}
              onChange={(e) => setCompte(e.target.value)}
              placeholder="Rechercher un compte..."
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
            <datalist id="comptes-list">
              {accounts.map((a) => (
                <option key={a.id} value={a.ccompte}>
                  {a.libelle}
                </option>
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg-secondary">
              SENS *
            </label>
            <div className="flex h-[42px] items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm text-fg-primary">
                <input
                  type="radio"
                  checked={sens === "debit"}
                  onChange={() => setSens("debit")}
                />
                Débit
              </label>
              <label className="flex items-center gap-1.5 text-sm text-fg-primary">
                <input
                  type="radio"
                  checked={sens === "credit"}
                  onChange={() => setSens("credit")}
                />
                Crédit
              </label>
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg-secondary">
              RÉF. FACT/D... *
            </label>
            <input
              type="text"
              value={refFactD}
              onChange={(e) => setRefFactD(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-fg-secondary">
              LIBELLE *
            </label>
            <input
              type="text"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg-secondary">
              MONTANT *
            </label>
            <input
              type="number"
              step="0.01"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className="w-full rounded-md border border-border-default bg-accent-green-bg px-3 py-2 text-fg-primary"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={ajouterLigne}
              aria-label="Ajouter la ligne"
              className="flex h-[42px] w-[42px] items-center justify-center rounded-md bg-accent-green text-on-accent hover:opacity-90"
            >
              ✓
            </button>
            <button
              onClick={annulerLigne}
              aria-label="Annuler la ligne"
              className="flex h-[42px] w-[42px] items-center justify-center rounded-md bg-danger-bg text-danger hover:opacity-90"
            >
              ✕
            </button>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        {success && <p className="mb-3 text-sm text-accent-green">{success}</p>}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-semibold text-fg-secondary">
              N°/CHQ/OV *
            </label>
            <input
              type="text"
              value={nChequeOv}
              onChange={(e) => setNChequeOv(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
          </div>
          <button
            onClick={genererLeReglement}
            className="rounded-full border border-border-default bg-surface-2 px-4 py-2 text-sm text-fg-secondary hover:bg-surface-1"
          >
            ✨ Générer Le Règlement
          </button>
          <div className="flex items-center justify-end gap-3">
            <p className="text-xs text-warning">
              Cliquez ici pour Enregistrer votre transaction !
            </p>
            <button
              onClick={handleValider}
              disabled={submitting}
              className="rounded-md bg-accent-blue px-6 py-2 font-medium text-on-accent hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "..." : "Validez"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border-default">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-2 text-fg-secondary">
              <tr>
                <th className="px-3 py-2 text-left">N° COMPTE - D</th>
                <th className="px-3 py-2 text-left">N° COMPTE - C</th>
                <th className="px-3 py-2 text-left">LIBELLE</th>
                <th className="px-3 py-2 text-right">MONTANT - D</th>
                <th className="px-3 py-2 text-right">MONTANT - C</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default bg-surface-1/60">
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-fg-muted">
                    Aucune ligne — utilise le bouton ✓ pour en ajouter.
                  </td>
                </tr>
              )}
              {lignes.map((l) => (
                <tr key={l.id} className="text-fg-primary">
                  <td className="px-3 py-2">{l.sens === "debit" ? l.compte : ""}</td>
                  <td className="px-3 py-2">{l.sens === "credit" ? l.compte : ""}</td>
                  <td className="px-3 py-2">{l.libelle}</td>
                  <td className="px-3 py-2 text-right">
                    {l.sens === "debit" ? l.montant.toLocaleString("fr-FR") : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {l.sens === "credit" ? l.montant.toLocaleString("fr-FR") : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => supprimerLigne(l.id)}
                      className="text-danger hover:underline"
                    >
                      retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {lignes.length > 0 && (
              <tfoot className="bg-surface-2 font-semibold text-fg-primary">
                <tr>
                  <td className="px-3 py-2" colSpan={3}>
                    TOTAUX
                  </td>
                  <td className="px-3 py-2 text-right">
                    {totalDebit.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {totalCredit.toLocaleString("fr-FR")}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
