// Reproduit CalculerSoldeBanqueProjet() du FIMS VBA (mod_FichePaiement) :
// solde de tous les mouvements TRESORERIE dont le compte commence par
// "5211" (le compte banque du PROJET, ex: 521100 "Banque projet BAMAKO" —
// distinct de 521200 "compte principal groupe" ou 522xxx "banques
// régionales"), sur toute la période (pas de filtre de date).
export const PREFIXE_COMPTE_BANQUE_PROJET = "5211";
