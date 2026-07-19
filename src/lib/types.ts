export type Profile = {
  id: string;
  organization_id: string;
  nom_utilisateur: string;
  role: string;
  created_at: string;
};

export type Project = {
  id: string;
  organization_id: string;
  nom_projet: string;
  code_projet: string;
  actif: boolean;
  date_debut_projet: string | null;
  date_fin_projet: string | null;
};

export type Organization = {
  id: string;
  nom: string;
  actif: boolean;
};

export type ChartOfAccount = {
  id: number;
  organization_id: string;
  project_id: string;
  compte: string;
  sous_compte: string | null;
  compte_tiers: boolean | null;
  ccompte: string;
  s_compte: string | null;
  libelle: string;
  type_compte: string | null;
};

export type ThirdParty = {
  id: number;
  organization_id: string;
  project_id: string;
  compte_classe_4: string | null;
  nom_tiers: string;
  type: string | null;
  contact: string | null;
  statut: string | null;
};

export type OperationType = {
  id: number;
  organization_id: string;
  code: string;
};

export type Zone = {
  id: number;
  organization_id: string;
  code: string;
  country_id: number | null;
};

export type BankJournal = {
  id: number;
  organization_id: string;
  code: string;
  libelle: string | null;
};

export type JournalEntry = {
  id: number;
  organization_id: string;
  project_id: string;
  date_operation: string;
  budget_line: string | null;
  categorie: string | null;
  type_operation: string | null;
  b_s_line: string | null;
  journal: string | null;
  n_ecriture_journal: string | null;
  compte_debit: string | null;
  compte_credit: string | null;
  tiers: string | null;
  ref_fact_d: string | null;
  n_cheque_ov: string | null;
  n_lettrage: string | null;
  n_piece: string | null;
  montant_debit: number;
  montant_credit: number;
  libelle: string;
  idc: string | null;
  date_heure_saisie: string;
  utilisateur: string;
  created_at: string;
  zone_id: number | null;
  tag_projet_local: string | null;
};
