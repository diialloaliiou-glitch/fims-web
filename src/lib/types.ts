export type Profile = {
  id: string;
  organization_id: string;
  nom_utilisateur: string;
  role: string;
  actif: boolean;
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
  donor_id: number | null;
  bank_account_number: string | null;
  requested_by: string | null;
  reviewed_by: string | null;
  authorized_by: string | null;
  country: string | null;
  is_template: boolean;
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
  zone_id: number | null;
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

export type Personnel = {
  id: number;
  organization_id: string;
  project_id: string | null;
  matricule: string;
  prenom_nom: string;
  poste: string | null;
  b_s_line: string | null;
  compte_classe_4: string | null;
  salaire_brut: number;
  inps_patronale: number | null;
  inps_ouvriere: number | null;
  its: number | null;
  tl_patronale: number | null;
  salaire_net: number;
  date_debut: string | null;
  date_fin: string | null;
  statut: string;
  zone_id: number | null;
};

export type PeriodClosure = {
  id: number;
  organization_id: string;
  project_id: string;
  type: string;
  periode: string;
  date_cloture: string;
  cloture_par: string;
  statut: string;
  date_reouverture: string | null;
  reouverture_par: string | null;
  motif_reouverture: string | null;
  created_at: string;
};

export type ErbLine = {
  id: number;
  organization_id: string;
  project_id: string;
  cote: "CHEZ_MOI" | "CHEZ_BANQUE";
  date_operation: string | null;
  reference: string | null;
  operation: string | null;
  montant_debit: number;
  montant_credit: number;
  pointe: boolean;
  created_at: string;
};

export type Donor = {
  id: number;
  organization_id: string;
  nom: string;
};

export type Rubrique = {
  id: number;
  organization_id: string;
  rubrique: string;
  code: string;
};

export type BudgetLine = {
  id: number;
  organization_id: string;
  project_id: string;
  code_1: string;
  icp: string | null;
  budget_line: string | null;
  our_line_code: string | null;
  description: string | null;
  rubrique: string | null;
  categorie: string | null;
  unit: string | null;
  quantity: number | null;
  frequence: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  ajustement: number | null;
  note: string | null;
  t_pec: string | null;
  unit_cost_devise: number | null;
  devise: string | null;
  taux_conversion: number | null;
  t_ic: string | null;
};

export type BudgetLineStaging = {
  id: number;
  organization_id: string;
  project_id: string;
  code_1: string;
  icp: string | null;
  budget_line: string | null;
  our_line_code: string | null;
  description: string | null;
  rubrique: string | null;
  unit: string | null;
  quantity: number | null;
  frequence: number | null;
  ajustement: number | null;
  note: string | null;
  t_pec: string | null;
  unit_cost_devise: number | null;
  devise: string | null;
  taux_conversion: number | null;
  t_ic: string | null;
  statut: string;
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
  modifie_par: string | null;
  modifie_le: string | null;
};
