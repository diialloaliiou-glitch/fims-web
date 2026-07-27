"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { periodeCouranteFermee } from "@/lib/period-closure";
import { nextSequence } from "@/lib/numerotation";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { Pill } from "@/components/ui/Pill";
import { ModelesEcritureModal, type ResultatModele } from "@/components/ModelesEcritureModal";
import { Cloud, Wand2 } from "lucide-react";
import type {
  BankJournal,
  BudgetLine,
  ChartOfAccount,
  OperationType,
  ThirdParty,
  Zone,
} from "@/lib/types";

// Reproduit ActualiserInterfaceContextuelle() du FIMS VBA d'origine : le
// journal disponible depend du type d'operation choisi. Les types absents
// de cette table (AVANCE et REGU, REGLEMENT, REVERSEMENT) restent sans
// restriction, exactement comme le "Case Else -> SupprimerValidation" VBA.
const JOURNAUX_PAR_TYPE: Record<string, string[]> = {
  "PRISE EN CHARGE": ["AC", "SA", "VT", "OD", "IM"],
  "OPERATIONS DIVERSES": ["OD"],
  TRESORERIE: ["BQ", "CS"],
};

type Ligne = {
  id: number;
  compte: string;
  sens: "debit" | "credit";
  libelle: string;
  montant: number;
  // Renseignes uniquement par les Modeles d'ecriture (reglement groupe de
  // plusieurs soldes en attente) : chaque ligne debit garde alors le tiers
  // et le n_piece de son solde d'origine plutot que ceux de l'en-tete.
  tiers?: string;
  nPieceOverride?: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

let ligneIdCounter = 1;

export default function SaisiePage() {
  const { profile, project } = useAuth();
  const { t } = useLanguage();

  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
  const [bankJournals, setBankJournals] = useState<BankJournal[]>([]);
  const [modelesOuvert, setModelesOuvert] = useState(false);
  const [journalIntermediaireOuvert, setJournalIntermediaireOuvert] = useState(false);

  const [dateOperation, setDateOperation] = useState(todayIso());
  const [journal, setJournal] = useState("");
  const [nEcritureJournal, setNEcritureJournal] = useState("");
  const [typeOperation, setTypeOperation] = useState("");
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
      .eq("organization_id", project.organization_id)
      .then(({ data }) => setThirdParties((data as ThirdParty[]) ?? []));

    supabase
      .from("zones")
      .select("*")
      .eq("organization_id", project.organization_id)
      .order("code")
      .then(({ data }) => setZones((data as Zone[]) ?? []));

    supabase
      .from("budget_lines")
      .select("*")
      .eq("project_id", project.id)
      .then(({ data }) => setBudgetLines((data as BudgetLine[]) ?? []));

    supabase
      .from("operation_types")
      .select("*")
      .eq("organization_id", project.organization_id)
      .order("code")
      .then(({ data }) => {
        const types = (data as OperationType[]) ?? [];
        setOperationTypes(types);
        setTypeOperation((current) => current || types[0]?.code || "");
      });

    supabase
      .from("bank_journals")
      .select("*")
      .eq("organization_id", project.organization_id)
      .order("code")
      .then(({ data }) => setBankJournals((data as BankJournal[]) ?? []));

    nextSequence(project.id, "n_piece", "PC").then(setNPiece);
  }, [project]);

  // Reproduit ActualiserInterfaceContextuelle() : le journal disponible
  // depend du type d'operation. Si le journal actuellement selectionne
  // n'est plus dans la liste autorisee, on bascule sur le premier valide.
  const codesAutorises = JOURNAUX_PAR_TYPE[typeOperation.toUpperCase()];
  const journauxDisponibles = codesAutorises
    ? bankJournals.filter((j) => codesAutorises.includes(j.code))
    : bankJournals;

  useEffect(() => {
    if (journauxDisponibles.length === 0) return;
    if (!journauxDisponibles.some((j) => j.code === journal)) {
      setJournal(journauxDisponibles[0].code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeOperation, bankJournals]);

  useEffect(() => {
    if (!project || !journal) return;
    nextSequence(project.id, "n_ecriture_journal", journal).then(setNEcritureJournal);
  }, [project, journal]);

  // Reproduit D9Actif() : B-S-Line n'est actif que pour ces 2 types.
  const bSLineActif = typeOperation === "OPERATIONS DIVERSES" || typeOperation === "TRESORERIE";
  useEffect(() => {
    if (!bSLineActif) setBSLine("");
  }, [bSLineActif]);

  // Reproduit D15Actif() : N°/Chq/OV n'est obligatoire/actif que pour BQ/CS.
  const nChequeOvActif = journal === "BQ" || journal === "CS";
  useEffect(() => {
    if (!nChequeOvActif) setNChequeOv("");
  }, [nChequeOvActif]);

  // Reproduit H9Actif()/GetListeTiersPourCompte() : le tiers n'est actif
  // que si le compte en cours de saisie est "porteur de tiers" (classe 4
  // rattachee a des tiers via third_parties.compte_classe_4), et la liste
  // est filtree a ceux de ce compte precis.
  const compteSaisiTrim = compte.trim();
  const tiersDisponibles = thirdParties.filter(
    (tp) => tp.compte_classe_4 && compteSaisiTrim.startsWith(tp.compte_classe_4)
  );
  const tiersActif = tiersDisponibles.length > 0;
  useEffect(() => {
    if (!tiersActif) setTiers("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compteSaisiTrim]);

  async function handleRefFactDBlur() {
    if (!project || !refFactD.trim()) return;
    // Reproduit ChercherPieceExistante() : reutilise le N°Piece existant
    // si la reference correspond deja a une ecriture passee.
    const { data } = await supabase
      .from("journal_entries")
      .select("n_piece")
      .eq("project_id", project.id)
      .eq("ref_fact_d", refFactD.trim())
      .not("n_piece", "is", null)
      .limit(1);
    if (data && data.length > 0 && data[0].n_piece) {
      setNPiece(data[0].n_piece);
    }
  }

  const totalDebit = lignes
    .filter((l) => l.sens === "debit")
    .reduce((s, l) => s + l.montant, 0);
  const totalCredit = lignes
    .filter((l) => l.sens === "credit")
    .reduce((s, l) => s + l.montant, 0);

  function ajouterLigne() {
    setError(null);
    if (!compte.trim()) {
      setError(t.saisie.erreurCompteObligatoire);
      return;
    }
    const montantNum = parseFloat(montant);
    if (!montantNum || montantNum <= 0) {
      setError(t.saisie.erreurMontantPositif);
      return;
    }
    if (!libelle.trim()) {
      setError(t.saisie.erreurLibelleObligatoire);
      return;
    }
    // Reproduit la verification H9Actif() du VBA : un compte porteur de
    // tiers exige un tiers selectionne avant d'ajouter la ligne.
    if (tiersActif && !tiers.trim()) {
      setError(t.saisie.modeles.erreurTiersObligatoire);
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
    setLibelle("");
    setSens("debit");
    setError(null);
  }

  function supprimerLigne(id: number) {
    setLignes(lignes.filter((l) => l.id !== id));
  }


  function appliquerModele(resultat: ResultatModele) {
    setTypeOperation(resultat.typeOperation);
    setJournal(resultat.journal);
    if (resultat.bSLine) setBSLine(resultat.bSLine);
    if (resultat.zoneId) setZoneId(resultat.zoneId);
    if (resultat.tiers) setTiers(resultat.tiers);
    if (resultat.refFactD) setRefFactD(resultat.refFactD);
    if (resultat.nChequeOv) setNChequeOv(resultat.nChequeOv);
    if (resultat.nPiece) setNPiece(resultat.nPiece);

    setLignes([
      ...lignes,
      ...resultat.lignes.map((l) => ({
        id: ligneIdCounter++,
        compte: l.compte,
        sens: l.sens,
        libelle: l.libelle,
        montant: l.montant,
        tiers: l.tiers,
        nPieceOverride: l.nPieceOverride,
      })),
    ]);
  }

  async function handleValider() {
    setError(null);
    setSuccess(null);

    if (lignes.length < 2) {
      setError(t.saisie.erreurMinDeuxLignes);
      return;
    }
    if (totalDebit !== totalCredit) {
      setError(
        `${t.saisie.totalDebit} (${totalDebit.toLocaleString("fr-FR")}) ${t.saisie.erreurTotauxDifferents} (${totalCredit.toLocaleString("fr-FR")}).`
      );
      return;
    }
    if (!project || !profile) {
      setError(t.saisie.erreurProjetProfil);
      return;
    }

    const blocageCloture = await periodeCouranteFermee(project.id);
    if (blocageCloture) {
      setError(blocageCloture);
      return;
    }

    setSubmitting(true);

    // Garde-fou : si l'onglet est reste en arriere-plan un moment, le
    // jeton de session peut avoir expire silencieusement (le timer de
    // rafraichissement de supabase-js est mis en pause hors-focus).
    // getSession() rafraichit automatiquement si necessaire avant l'ecriture.
    await supabase.auth.getSession();

    const nej = await nextSequence(project.id, "n_ecriture_journal", journal);

    // IDC (identifiant mensuel "mois_annee", ex: "7_2026") est utilise par
    // BUD TRACKER pour regrouper les depenses par mois (JDEPENSE[IDC]) -
    // sans lui, la ligne est silencieusement ignoree du suivi budgetaire.
    const [anneeOp, moisOp] = dateOperation.split("-");
    const idc = `${parseInt(moisOp, 10)}_${anneeOp}`;

    // Reproduit BuildDatabaseLookup()/ValiderEtTransférer() : PROJECT ID,
    // BUDGET LINE et CATEGORIE viennent d'une recherche sur B-S-LINE dans
    // la table DATABASE (budget_lines chez nous), pas d'une saisie directe.
    const ligneBudget = bSLine
      ? budgetLines.find((b) => (b.our_line_code ?? "").toUpperCase() === bSLine.toUpperCase())
      : undefined;

    const common = {
      organization_id: profile.organization_id,
      project_id: project.id,
      date_operation: dateOperation,
      type_operation: typeOperation,
      journal,
      n_ecriture_journal: nej,
      idc,
      b_s_line: bSLine || null,
      budget_line: ligneBudget?.budget_line ?? null,
      categorie: ligneBudget?.categorie ?? null,
      tag_projet_local: project.code_projet,
      zone_id: zoneId ? parseInt(zoneId, 10) : null,
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
      n_piece: l.nPieceOverride ?? nPiece ?? null,
      tiers: l.tiers ?? tiers ?? null,
    }));

    const { error: insertError } = await supabase.from("journal_entries").insert(rows);

    setSubmitting(false);

    if (insertError) {
      setError(`${t.saisie.erreurEnregistrement} ${insertError.message}`);
      return;
    }

    setSuccess(`${t.saisie.ecritureEnregistree} ${nej} ${t.saisie.enregistreeNLignes} (${rows.length} ${t.saisie.lignesLabel}).`);
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

  // Reserve au COMPTABLE (+ ADMIN_N1) - ni RAF ni ADMIN_SITE ne doivent
  // acceder a la Saisie, contrairement a la hierarchie de roles habituelle.
  if (profile?.role !== "ADMIN_N1" && profile?.role !== "COMPTABLE") {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">{t.dashboard.tileSaisie}</h1>
        <p className="text-sm text-text-secondary">
          {t.saisie.permissionInfo.replace("{role}", profile?.role ?? "")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="hidden w-32 shrink-0 flex-col gap-3 sm:flex">
        <Pill href="/lettrage">{t.saisie.lettrage}</Pill>
        <Pill href="/lettrage">{t.saisie.delettrage}</Pill>
      </div>

      <div className="flex-1">
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            <span className="hidden sm:inline">{t.saisie.dateComptable} </span>
            {new Date().toLocaleString("fr-FR")}
          </p>
          <p className="text-center text-sm font-medium text-text-secondary">
            {t.login.sousTitre}
          </p>
          <Pill onClick={() => setJournalIntermediaireOuvert(true)}>
            {t.saisie.accederJournalIntermediaire}
          </Pill>
        </div>

        <div className="mb-6">
          <Pill icon={Wand2} onClick={() => setModelesOuvert(true)}>
            {t.saisie.modelesEcriture}
          </Pill>
        </div>

        <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-border-subtle bg-bg-card py-4">
          <Cloud className="h-8 w-8 text-accent-teal" strokeWidth={1.6} />
          <p className="text-xs text-text-secondary">{t.saisie.nJournal}</p>
          <p className="text-lg font-bold text-accent-teal">{nEcritureJournal || "—"}</p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-5">
          <FormField
            label={t.saisie.dateDeLaPiece}
            required
            type="date"
            value={dateOperation}
            onChange={(e) => setDateOperation(e.target.value)}
          />
          <FormField label={t.saisie.nPiece} value={nPiece} disabled />
          <FormField label={t.saisie.typeOperation} required>
            <select
              value={typeOperation}
              onChange={(e) => setTypeOperation(e.target.value)}
              className={fieldControlClass}
            >
              {operationTypes.map((op) => (
                <option key={op.id} value={op.code}>
                  {op.code}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t.saisie.journal} required>
            <select
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
              className={fieldControlClass}
            >
              {journauxDisponibles.map((j) => (
                <option key={j.id} value={j.code}>
                  {j.code}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t.saisie.bSLine}>
            {bSLineActif ? (
              <select
                value={bSLine}
                onChange={(e) => setBSLine(e.target.value)}
                className={fieldControlClass}
              >
                <option value="">—</option>
                {budgetLines.map((b) => (
                  <option key={b.id} value={b.our_line_code ?? ""}>
                    {b.our_line_code}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value=""
                disabled
                placeholder={t.saisie.champInactif}
                className={`${fieldControlClass} opacity-50`}
              />
            )}
          </FormField>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-5">
          <FormField label={t.saisie.zone} required>
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
          <FormField label={t.saisie.tiers} required={tiersActif}>
            {tiersActif ? (
              <>
                <input
                  list="tiers-list"
                  type="text"
                  value={tiers}
                  onChange={(e) => setTiers(e.target.value)}
                  className={fieldControlClass}
                />
                <datalist id="tiers-list">
                  {tiersDisponibles.map((tp) => (
                    <option key={tp.id} value={tp.nom_tiers} />
                  ))}
                </datalist>
              </>
            ) : (
              <input
                type="text"
                value=""
                disabled
                placeholder={t.saisie.champInactif}
                className={`${fieldControlClass} opacity-50`}
              />
            )}
          </FormField>
          <FormField label={t.saisie.nCompte} required>
            <input
              list="comptes-list"
              type="text"
              value={compte}
              onChange={(e) => setCompte(e.target.value)}
              placeholder={t.saisie.rechercherCompte}
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
          <FormField label={t.saisie.sens} required>
            <div className="flex h-[42px] items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm text-text-primary">
                <input
                  type="radio"
                  checked={sens === "debit"}
                  onChange={() => setSens("debit")}
                />
                {t.saisie.debit}
              </label>
              <label className="flex items-center gap-1.5 text-sm text-text-primary">
                <input
                  type="radio"
                  checked={sens === "credit"}
                  onChange={() => setSens("credit")}
                />
                {t.saisie.credit}
              </label>
            </div>
          </FormField>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-5">
          <FormField
            label={t.saisie.refFactD}
            required
            value={refFactD}
            onChange={(e) => setRefFactD(e.target.value)}
            onBlur={handleRefFactDBlur}
          />
          <div className="sm:col-span-2">
            <FormField label={t.saisie.libelle} required value={libelle} onChange={(e) => setLibelle(e.target.value)} />
          </div>
          <FormField label={t.saisie.montant} required>
            <input
              type="number"
              step="0.01"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className={`${fieldControlClass} bg-bg-card-teal`}
            />
          </FormField>
          <div className="flex items-end gap-2">
            <IconButton variant="confirm" ariaLabel={t.saisie.ajouterLigne} onClick={ajouterLigne} rounded="md" />
            <IconButton variant="cancel" ariaLabel={t.saisie.annulerLigne} onClick={annulerLigne} rounded="md" />
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}
        {success && <p className="mb-3 text-sm text-accent-teal">{success}</p>}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
          <FormField
            label={t.saisie.nChqOv}
            required={nChequeOvActif}
            value={nChequeOv}
            onChange={(e) => setNChequeOv(e.target.value)}
            disabled={!nChequeOvActif}
            placeholder={nChequeOvActif ? undefined : t.saisie.champInactif}
          />
          <div className="flex items-center justify-end gap-3">
            <p className="text-xs text-accent-amber">
              {t.saisie.cliquezPourEnregistrer}
            </p>
            <PrimaryButton onClick={handleValider} disabled={submitting}>
              {submitting ? "..." : t.saisie.validez}
            </PrimaryButton>
          </div>
        </div>

        <div className="max-h-[65vh] overflow-auto rounded-xl border border-border-subtle print:max-h-none print:overflow-visible">
          <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
            <MiniTableHeader
              columns={[t.saisie.colNCompteD, t.saisie.colNCompteC, t.common.libelle, t.saisie.colMontantD, t.saisie.colMontantC, ""]}
              align={["left", "left", "left", "right", "right", "left"]}
            />
            <tbody className="divide-y divide-border-subtle bg-bg-card/60">
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-text-secondary">
                    {t.saisie.aucuneLigne}
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
                      {t.saisie.retirer}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {lignes.length > 0 && (
              <tfoot className="bg-bg-card font-semibold text-text-primary">
                <tr>
                  <td className="px-3 py-2" colSpan={3}>
                    {t.saisie.totaux}
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

      {modelesOuvert && project && (
        <ModelesEcritureModal
          open={modelesOuvert}
          onClose={() => setModelesOuvert(false)}
          project={project}
          thirdParties={thirdParties}
          zones={zones}
          budgetLines={budgetLines}
          operationTypes={operationTypes}
          bankJournals={bankJournals}
          onGenerer={appliquerModele}
        />
      )}

      {journalIntermediaireOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-5xl overflow-auto rounded-xl border border-border-subtle bg-bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold text-text-primary">
                {t.saisie.journalIntermediaire.titre}
              </p>
              <button
                onClick={() => setJournalIntermediaireOuvert(false)}
                className="text-sm text-accent-blue hover:underline"
              >
                {t.saisie.journalIntermediaire.retour}
              </button>
            </div>

            <div className="overflow-auto rounded-lg border border-border-subtle">
              <table className="min-w-full text-sm [&_td]:whitespace-nowrap [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
                <MiniTableHeader
                  columns={[
                    t.common.date,
                    t.saisie.typeOperation,
                    t.saisie.bSLine,
                    t.saisie.journal,
                    t.jdepense.colNEJ,
                    t.saisie.journalIntermediaire.colCptD,
                    t.saisie.journalIntermediaire.colCptC,
                    t.saisie.tiers,
                    t.saisie.refFactD,
                    t.saisie.nChqOv,
                    t.saisie.nPiece,
                    t.saisie.zone,
                    t.saisie.colMontantD,
                    t.saisie.colMontantC,
                    t.common.libelle,
                    t.jdepense.colDateHeureSaisie,
                    t.jdepense.colUtilisateur,
                  ]}
                  align={[
                    "left", "left", "left", "left", "left", "left", "left", "left",
                    "left", "left", "left", "left", "right", "right", "left", "left", "left",
                  ]}
                  noWrap
                />
                <tbody className="divide-y divide-border-subtle bg-bg-card/60">
                  {lignes.length === 0 && (
                    <tr>
                      <td colSpan={17} className="px-3 py-4 text-center text-text-secondary">
                        {t.saisie.journalIntermediaire.vide}
                      </td>
                    </tr>
                  )}
                  {lignes.map((l) => (
                    <tr key={l.id} className="text-text-primary">
                      <td className="px-2 py-1.5">
                        {new Date(dateOperation).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-2 py-1.5">{typeOperation}</td>
                      <td className="px-2 py-1.5">{bSLine}</td>
                      <td className="px-2 py-1.5">{journal}</td>
                      <td className="px-2 py-1.5">{nEcritureJournal}</td>
                      <td className="px-2 py-1.5">{l.sens === "debit" ? l.compte : ""}</td>
                      <td className="px-2 py-1.5">{l.sens === "credit" ? l.compte : ""}</td>
                      <td className="px-2 py-1.5">{l.tiers ?? tiers}</td>
                      <td className="px-2 py-1.5">{refFactD}</td>
                      <td className="px-2 py-1.5">{nChequeOv}</td>
                      <td className="px-2 py-1.5">{l.nPieceOverride ?? nPiece}</td>
                      <td className="px-2 py-1.5">
                        {zones.find((z) => String(z.id) === zoneId)?.code ?? ""}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {l.sens === "debit" ? l.montant.toLocaleString("fr-FR") : ""}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {l.sens === "credit" ? l.montant.toLocaleString("fr-FR") : ""}
                      </td>
                      <td className="px-2 py-1.5">{l.libelle}</td>
                      <td className="px-2 py-1.5">{new Date().toLocaleString("fr-FR")}</td>
                      <td className="px-2 py-1.5">{profile?.nom_utilisateur}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
