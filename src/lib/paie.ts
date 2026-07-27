import { supabase } from "./supabase";
import type { Personnel, PayrollMappingKey, Profile, Project } from "./types";

export class IncoherenceSalaireError extends Error {}

// Les 9 comptes de la prise en charge salaire sont configurables par projet
// (Parametres > Comptes de paie) car ils varient d'un pays a l'autre - ces
// codes ne sont utilises que comme suggestion de depart pour cet ecran.
export const PAYROLL_MAPPING_KEYS: {
  cle: PayrollMappingKey;
  libelle: string;
  sens: "debit" | "credit";
  compteSuggere: string;
}[] = [
  { cle: "SALAIRE_BRUT_DEBIT", libelle: "Salaire brut (débit)", sens: "debit", compteSuggere: "661100" },
  { cle: "INPS_PATRONALE_DEBIT", libelle: "INPS patronale (débit)", sens: "debit", compteSuggere: "664100" },
  { cle: "AMO_PATRONALE_DEBIT", libelle: "AMO patronale (débit)", sens: "debit", compteSuggere: "664200" },
  { cle: "TL_PATRONALE_DEBIT", libelle: "Taxe sur salaires - TL (débit)", sens: "debit", compteSuggere: "641300" },
  { cle: "SALAIRE_NET_CREDIT", libelle: "Salaire net à payer (crédit)", sens: "credit", compteSuggere: "422100" },
  { cle: "INPS_CREDIT", libelle: "INPS ouvrière + patronale (crédit)", sens: "credit", compteSuggere: "431100" },
  { cle: "AMO_CREDIT", libelle: "AMO (crédit)", sens: "credit", compteSuggere: "433300" },
  { cle: "ITS_CREDIT", libelle: "ITS (crédit)", sens: "credit", compteSuggere: "447200" },
  { cle: "TL_CREDIT", libelle: "Taxe sur salaires - TL (crédit)", sens: "credit", compteSuggere: "447300" },
];

export function debutDuMois(mois: string) {
  return `${mois}-01`;
}

export function finDuMois(mois: string) {
  const [y, m] = mois.split("-").map((v) => parseInt(v, 10));
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

export function idcDuMois(mois: string) {
  const [annee, moisNum] = mois.split("-");
  return `${parseInt(moisNum, 10)}_${annee}`;
}

// Employes proposables pour la prise en charge d'un mois donne : actifs et
// dont la periode d'emploi couvre au moins partiellement ce mois.
export function employesEligibles(personnel: Personnel[], mois: string) {
  const debut = debutDuMois(mois);
  const fin = finDuMois(mois);
  return personnel.filter((p) => {
    if (p.statut !== "Actif") return false;
    if (p.date_debut && p.date_debut > fin) return false;
    if (p.date_fin && p.date_fin < debut) return false;
    return true;
  });
}

export type LignePaieGeneree = {
  organization_id: string;
  project_id: string;
  date_operation: string;
  type_operation: string;
  journal: string;
  n_ecriture_journal: string;
  n_piece: string | null;
  idc: string;
  b_s_line: null;
  budget_line: null;
  categorie: null;
  tag_projet_local: string | null;
  zone_id: number | null;
  ref_fact_d: null;
  n_cheque_ov: null;
  date_heure_saisie: string;
  utilisateur: string;
  created_at: string;
  compte_debit: string | null;
  compte_credit: string | null;
  montant_debit: number;
  montant_credit: number;
  libelle: string;
  tiers: string;
};

// Genere les 9 lignes de prise en charge (x pourcentage de repartition pour
// ce projet) pour un employe. Verifie l'equilibre debit/credit avant de
// retourner les lignes - leve IncoherenceSalaireError sinon plutot que de
// forcer une ecriture desequilibree.
export function genererLignesPaie(params: {
  employe: Personnel;
  pourcentage: number;
  mois: string;
  mapping: Map<PayrollMappingKey, string>;
  project: Project;
  profile: Profile;
  nej: string;
  nPiece: string;
}): LignePaieGeneree[] {
  const { employe, pourcentage, mois, mapping, project, profile, nej, nPiece } = params;

  const netAttendu = employe.salaire_brut - (employe.inps_ouvriere ?? 0) - (employe.its ?? 0);
  if (Math.round(employe.salaire_net) !== Math.round(netAttendu)) {
    throw new IncoherenceSalaireError(
      `${employe.matricule} - ${employe.prenom_nom} : salaire net enregistré (${employe.salaire_net}) ne correspond pas à brut - INPS ouvrière - ITS (${netAttendu}). Corriger la fiche personnel avant de générer.`
    );
  }

  const ratio = pourcentage / 100;
  const amo = (employe.amo ?? 0) * ratio;
  const inpsPatronale = (employe.inps_patronale ?? 0) * ratio;
  const inpsOuvriere = (employe.inps_ouvriere ?? 0) * ratio;
  const its = (employe.its ?? 0) * ratio;
  const tlPatronale = (employe.tl_patronale ?? 0) * ratio;
  const salaireBrut = employe.salaire_brut * ratio;
  const salaireNet = employe.salaire_net * ratio;

  const debits: { cle: PayrollMappingKey; montant: number }[] = [
    { cle: "SALAIRE_BRUT_DEBIT", montant: salaireBrut },
    { cle: "INPS_PATRONALE_DEBIT", montant: inpsPatronale },
    { cle: "AMO_PATRONALE_DEBIT", montant: amo },
    { cle: "TL_PATRONALE_DEBIT", montant: tlPatronale },
  ];
  const debitsRoundes = debits.map((l) => ({ ...l, montant: Math.round(l.montant) }));
  const totalDebit = debitsRoundes.reduce((s, l) => s + l.montant, 0);

  // Le credit "TL_CREDIT" absorbe le residu d'arrondi (au plus quelques
  // francs, aucune monnaie fractionnaire en FCFA) plutot que de bloquer une
  // repartition en pourcentage legitime pour une difference d'arrondi.
  const creditsAvantPlug: { cle: PayrollMappingKey; montant: number }[] = [
    { cle: "SALAIRE_NET_CREDIT", montant: salaireNet },
    { cle: "INPS_CREDIT", montant: inpsOuvriere + inpsPatronale },
    { cle: "AMO_CREDIT", montant: amo },
    { cle: "ITS_CREDIT", montant: its },
  ];
  const creditsAvantPlugRoundes = creditsAvantPlug.map((l) => ({ ...l, montant: Math.round(l.montant) }));
  const sommeCreditsAvantPlug = creditsAvantPlugRoundes.reduce((s, l) => s + l.montant, 0);
  const tlCreditPlug = totalDebit - sommeCreditsAvantPlug;
  const tlCreditBrut = Math.round(tlPatronale);

  if (Math.abs(tlCreditPlug - tlCreditBrut) > 5) {
    throw new IncoherenceSalaireError(
      `${employe.matricule} - ${employe.prenom_nom} : débit (${totalDebit}) et crédit ne s'équilibrent pas pour cette prise en charge (écart de ${Math.abs(tlCreditPlug - tlCreditBrut)}). Vérifier les montants de la fiche personnel.`
    );
  }

  const lignesBrutes: { cle: PayrollMappingKey; sens: "debit" | "credit"; montant: number }[] = [
    ...debitsRoundes.map((l) => ({ ...l, sens: "debit" as const })),
    ...creditsAvantPlugRoundes.map((l) => ({ ...l, sens: "credit" as const })),
    { cle: "TL_CREDIT", sens: "credit", montant: tlCreditPlug },
  ];

  const idc = idcDuMois(mois);
  const [, moisNum] = mois.split("-");
  const [annee] = mois.split("-");
  const libelle = `Salaire ${moisNum}/${annee} - ${employe.matricule} - ${employe.prenom_nom}`;
  const now = new Date().toISOString();

  return lignesBrutes
    .filter((l) => l.montant > 0)
    .map((l) => {
      const compte = mapping.get(l.cle);
      if (!compte) {
        throw new IncoherenceSalaireError(
          `Compte non configuré pour "${l.cle}" sur ce projet - voir Paramètres > Comptes de paie.`
        );
      }
      return {
        organization_id: profile.organization_id,
        project_id: project.id,
        date_operation: finDuMois(mois),
        type_operation: "PRISE EN CHARGE",
        journal: "SA",
        n_ecriture_journal: nej,
        n_piece: nPiece,
        idc,
        b_s_line: null,
        budget_line: null,
        categorie: null,
        tag_projet_local: project.code_projet,
        zone_id: employe.zone_id,
        ref_fact_d: null,
        n_cheque_ov: null,
        date_heure_saisie: now,
        utilisateur: profile.nom_utilisateur,
        created_at: now,
        compte_debit: l.sens === "debit" ? compte : null,
        compte_credit: l.sens === "credit" ? compte : null,
        montant_debit: l.sens === "debit" ? l.montant : 0,
        montant_credit: l.sens === "credit" ? l.montant : 0,
        libelle,
        tiers: employe.matricule,
      };
    });
}

// Au reglement (Modeles d'ecriture, soldes en attente), retrouve pour
// chaque tiers = matricule d'employe le B-S-Line que la repartition
// multi-projet lui attribuait le mois ou la dette a ete constatee - permet
// de repartir analytiquement un reglement groupe (plusieurs employes, un
// seul virement) au lieu d'un B-S-Line unique pour toute l'ecriture.
export async function bSLinesPourReglement(
  organizationId: string,
  projectId: string,
  lignes: { matricule: string; dateOperation: string }[]
): Promise<Map<string, string>> {
  const matricules = Array.from(new Set(lignes.map((l) => l.matricule).filter(Boolean)));
  const resultat = new Map<string, string>();
  if (matricules.length === 0) return resultat;

  const { data: personnelData } = await supabase
    .from("personnel")
    .select("id, matricule")
    .eq("organization_id", organizationId)
    .in("matricule", matricules);

  const matriculeParId = new Map((personnelData ?? []).map((p) => [p.id, p.matricule]));
  const personnelIds = Array.from(matriculeParId.keys());
  if (personnelIds.length === 0) return resultat;

  const { data: repartitionData } = await supabase
    .from("personnel_repartition")
    .select("personnel_id, mois, b_s_line")
    .eq("project_id", projectId)
    .in("personnel_id", personnelIds);

  (repartitionData ?? []).forEach((r) => {
    if (!r.b_s_line) return;
    const matricule = matriculeParId.get(r.personnel_id);
    if (!matricule) return;
    const mois = String(r.mois).slice(0, 7);
    resultat.set(`${matricule}|${mois}`, r.b_s_line);
  });

  return resultat;
}

export async function verifierAntiDoublon(projectId: string, matricule: string, idc: string) {
  const { data } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("project_id", projectId)
    .eq("journal", "SA")
    .eq("tiers", matricule)
    .eq("idc", idc)
    .limit(1);
  return (data?.length ?? 0) > 0;
}
