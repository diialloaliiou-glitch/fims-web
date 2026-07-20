"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { periodeCouranteFermee } from "@/lib/period-closure";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { Pill } from "@/components/ui/Pill";
import { Cloud } from "lucide-react";
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
        <Pill href="/lettrage">Lettrage</Pill>
        <Pill href="/lettrage">Délettrage</Pill>
      </div>

      <div className="flex-1">
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            <span className="hidden sm:inline">DATE COMPTABLE : </span>
            {new Date().toLocaleString("fr-FR")}
          </p>
          <p className="text-center text-sm font-medium text-text-secondary">
            Financial Information Management System
          </p>
          <Pill onClick={() => afficherNotice("Journal intermédiaire : fonctionnalité à venir.")}>
            Accéder au journal intermédiaire
          </Pill>
        </div>

        <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-border-subtle bg-bg-card py-4">
          <Cloud className="h-8 w-8 text-accent-teal" strokeWidth={1.6} />
          <p className="text-xs text-text-secondary">N° JOURNAL</p>
          <p className="text-lg font-bold text-accent-teal">{nEcritureJournal || "—"}</p>
        </div>

        {notice && (
          <p className="mb-4 rounded-md bg-bg-card px-4 py-2 text-sm text-accent-amber">
            {notice}
          </p>
        )}

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-5">
          <FormField
            label="Date de la pièce"
            required
            type="date"
            value={dateOperation}
            onChange={(e) => setDateOperation(e.target.value)}
          />
          <FormField label="N°Pièce" value={nPiece} onChange={(e) => setNPiece(e.target.value)} />
          <FormField label="Type d'opération" required>
            <select
              value={typeOperation}
              onChange={(e) => setTypeOperation(e.target.value)}
              className={fieldControlClass}
            >
              {TYPES_OPERATION.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Journal" required>
            <select
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
              className={fieldControlClass}
            >
              {JOURNAUX.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="B-S-Line" value={bSLine} onChange={(e) => setBSLine(e.target.value)} />
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-5">
          <FormField label="Zone" required>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className={fieldControlClass}
            >
              <option value="">—</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Tiers" required>
            <input
              list="tiers-list"
              type="text"
              value={tiers}
              onChange={(e) => setTiers(e.target.value)}
              className={fieldControlClass}
            />
            <datalist id="tiers-list">
              {thirdParties.map((t) => (
                <option key={t.id} value={t.nom_tiers} />
              ))}
            </datalist>
          </FormField>
          <FormField label="N° Compte" required>
            <input
              list="comptes-list"
              type="text"
              value={compte}
              onChange={(e) => setCompte(e.target.value)}
              placeholder="Rechercher un compte..."
              className={fieldControlClass}
            />
            <datalist id="comptes-list">
              {accounts.map((a) => (
                <option key={a.id} value={a.ccompte}>
                  {a.libelle}
                </option>
              ))}
            </datalist>
          </FormField>
          <FormField label="Sens" required>
            <div className="flex h-[42px] items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm text-text-primary">
                <input
                  type="radio"
                  checked={sens === "debit"}
                  onChange={() => setSens("debit")}
                />
                Débit
              </label>
              <label className="flex items-center gap-1.5 text-sm text-text-primary">
                <input
                  type="radio"
                  checked={sens === "credit"}
                  onChange={() => setSens("credit")}
                />
                Crédit
              </label>
            </div>
          </FormField>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-5">
          <FormField label="Réf. Fact/D..." required value={refFactD} onChange={(e) => setRefFactD(e.target.value)} />
          <div className="sm:col-span-2">
            <FormField label="Libellé" required value={libelle} onChange={(e) => setLibelle(e.target.value)} />
          </div>
          <FormField label="Montant" required>
            <input
              type="number"
              step="0.01"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className={`${fieldControlClass} bg-bg-card-teal`}
            />
          </FormField>
          <div className="flex items-end gap-2">
            <IconButton variant="confirm" ariaLabel="Ajouter la ligne" onClick={ajouterLigne} rounded="md" />
            <IconButton variant="cancel" ariaLabel="Annuler la ligne" onClick={annulerLigne} rounded="md" />
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}
        {success && <p className="mb-3 text-sm text-accent-teal">{success}</p>}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <FormField label="N°/Chq/OV" required value={nChequeOv} onChange={(e) => setNChequeOv(e.target.value)} />
          <Pill icon={undefined} onClick={genererLeReglement}>
            ✨ Générer Le Règlement
          </Pill>
          <div className="flex items-center justify-end gap-3">
            <p className="text-xs text-accent-amber">
              Cliquez ici pour Enregistrer votre transaction !
            </p>
            <PrimaryButton onClick={handleValider} disabled={submitting}>
              {submitting ? "..." : "Validez"}
            </PrimaryButton>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border-subtle">
          <table className="min-w-full text-sm">
            <MiniTableHeader
              columns={["N° Compte - D", "N° Compte - C", "Libelle", "Montant - D", "Montant - C", ""]}
              align={["left", "left", "left", "right", "right", "left"]}
            />
            <tbody className="divide-y divide-border-subtle bg-bg-card/60">
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-text-secondary">
                    Aucune ligne — utilise le bouton ✓ pour en ajouter.
                  </td>
                </tr>
              )}
              {lignes.map((l) => (
                <tr key={l.id} className="text-text-primary">
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
                      className="text-accent-red hover:underline"
                    >
                      retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {lignes.length > 0 && (
              <tfoot className="bg-bg-card font-semibold text-text-primary">
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
