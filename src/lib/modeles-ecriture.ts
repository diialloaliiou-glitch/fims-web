// Reproduit mod_ModeleEcriture.bas (FIMS.xlsm) : catalogue fixe de modeles
// d'ecriture pre-remplissant les comptes debit/credit pour eviter les
// erreurs de saisie manuelle. Verifie ligne par ligne contre le vrai
// module VBA (GetCatalogue / GetModeleProps / GetChoixBanques / GetChoixZones471).

export type ChoixCompte = { code: string; label: string };

export type CoteCompte = {
  fixe?: string;
  choix?: ChoixCompte[];
};

export type ModeleProps = {
  typeOp: string;
  journal: string;
  debit?: CoteCompte;
  credit?: CoteCompte;
  bslVisible: boolean;
  avecSoldes?: boolean;
  multiSelect?: boolean;
  info?: string;
};

export const BANQUES: ChoixCompte[] = [
  { code: "521100", label: "Banque projet BAMAKO" },
  { code: "521200", label: "Compte principal AMSODE" },
  { code: "522100", label: "Banque régionale TOMBOUCTOU" },
  { code: "522200", label: "Banque régionale GAO" },
  { code: "522300", label: "Banque régionale SEGOU" },
  { code: "522400", label: "Banque régionale MOPTI" },
  { code: "522500", label: "Banque régionale SIKASSO" },
];

export const ZONES_471: ChoixCompte[] = [
  { code: "471101", label: "Avance zone BAMAKO" },
  { code: "471102", label: "Avance zone TOMBOUCTOU" },
  { code: "471103", label: "Avance zone GAO" },
  { code: "471104", label: "Avance zone MOPTI" },
  { code: "471105", label: "Avance zone SEGOU" },
  { code: "471106", label: "Avance zone SIKASSO" },
  { code: "471109", label: "Autres avances divers" },
];

// typeOp -> journal -> liste ordonnee des noms de modeles.
export const CATALOGUE: { typeOp: string; journal: string; modeles: string[] }[] = [
  {
    typeOp: "PRISE EN CHARGE",
    journal: "AC",
    modeles: [
      "Achat direct programme",
      "Prestation de service",
      "Loyer bureau",
      "Location véhicule hors mission",
      "Facture eau / électricité / générateur",
      "Frais bancaires (débit auto)",
    ],
  },
  { typeOp: "PRISE EN CHARGE", journal: "SA", modeles: ["Constatation salaire (SA)"] },
  { typeOp: "PRISE EN CHARGE", journal: "VT", modeles: ["Vente de biens", "Vente de services"] },
  {
    typeOp: "PRISE EN CHARGE",
    journal: "OD",
    modeles: [
      "Demande de fonds bailleur",
      "Neutralisation fin exercice",
      "Report fonds non consommés",
      "Reprise subvention bailleur",
    ],
  },
  {
    typeOp: "PRISE EN CHARGE",
    journal: "IM",
    modeles: ["Acquisition immobilisation", "Dotation amortissement"],
  },
  {
    typeOp: "OPERATIONS DIVERSES",
    journal: "OD",
    modeles: ["Apurement avance terrain", "Apurement avance salaire", "Cash transfer via avance"],
  },
  {
    typeOp: "TRESORERIE",
    journal: "BQ",
    modeles: [
      "Règlement fournisseur",
      "Règlement prestataire",
      "Avance comptable terrain",
      "Virement vers banque régionale",
      "Réception banque régionale",
      "ICR / Frais admin vers AMSODE",
      "Net personnel",
      "Reversement INPS",
      "Reversement DGI ITS/TL",
      "Cash transfer direct",
      "Réception fonds bailleur",
      "Avance sur salaire",
    ],
  },
  { typeOp: "TRESORERIE", journal: "CS", modeles: ["Paiement caisse"] },
];

export function typesOperationDisponibles(): string[] {
  return Array.from(new Set(CATALOGUE.map((c) => c.typeOp)));
}

export function journauxPour(typeOp: string): string[] {
  return CATALOGUE.filter((c) => c.typeOp === typeOp).map((c) => c.journal);
}

export function modelesPour(typeOp: string, journal: string): string[] {
  return CATALOGUE.find((c) => c.typeOp === typeOp && c.journal === journal)?.modeles ?? [];
}

export function getModeleProps(nom: string): ModeleProps | null {
  switch (nom) {
    case "Achat direct programme":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "AC",
        debit: {
          choix: [
            { code: "601100", label: "Fournitures de bureau" },
            { code: "601200", label: "Fournitures informatiques" },
            { code: "601300", label: "Matériels non immobilisables" },
            { code: "601400", label: "Produits alimentaires / NFI" },
            { code: "601500", label: "Médicaments et consommables" },
            { code: "601600", label: "Matériaux et petits outillages" },
            { code: "601700", label: "Carburant véhicules opérationnels" },
            { code: "601800", label: "Autres achats directs programme" },
          ],
        },
        credit: { fixe: "401100" },
        bslVisible: false,
      };
    case "Prestation de service":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "AC",
        debit: { fixe: "632700" },
        credit: { fixe: "401200" },
        bslVisible: false,
      };
    case "Loyer bureau":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "AC",
        debit: { fixe: "622200" },
        credit: { fixe: "401100" },
        bslVisible: false,
      };
    case "Location véhicule hors mission":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "AC",
        debit: { fixe: "622300" },
        credit: { fixe: "401100" },
        bslVisible: false,
      };
    case "Facture eau / électricité / générateur":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "AC",
        debit: {
          choix: [
            { code: "605100", label: "Eau — EDM" },
            { code: "605200", label: "Électricité — EDM" },
            { code: "605310", label: "Carburant groupe électrogène" },
            { code: "605300", label: "Autres énergies" },
          ],
        },
        credit: { choix: [{ code: "401100", label: "Fournisseur" }, ...BANQUES] },
        bslVisible: false,
      };
    case "Frais bancaires (débit auto)":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "AC",
        debit: { fixe: "631800" },
        credit: { choix: BANQUES },
        bslVisible: false,
      };
    case "Constatation salaire (SA)":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "SA",
        bslVisible: false,
        info: "Utilisez le bouton « Paie SA » pour générer automatiquement.",
      };
    case "Demande de fonds bailleur":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "OD",
        debit: { fixe: "458111" },
        credit: { fixe: "461000" },
        bslVisible: false,
      };
    case "Neutralisation fin exercice":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "OD",
        debit: { fixe: "461000" },
        credit: { fixe: "702000" },
        bslVisible: false,
      };
    case "Report fonds non consommés":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "OD",
        debit: { fixe: "461000" },
        credit: { fixe: "165000" },
        bslVisible: false,
      };
    case "Reprise subvention bailleur":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "OD",
        debit: { fixe: "141700" },
        credit: { fixe: "799000" },
        bslVisible: false,
      };
    case "Acquisition immobilisation":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "IM",
        debit: {
          choix: [
            { code: "244100", label: "Mobilier bureau (armoire, table...)" },
            { code: "244200", label: "Matériel informatique / imprimante" },
            { code: "245100", label: "Matériel automobile / véhicule" },
            { code: "241100", label: "Matériel et outillage" },
            { code: "235000", label: "Aménagements de bureaux" },
            { code: "213100", label: "Logiciels" },
          ],
        },
        credit: { fixe: "401100" },
        bslVisible: false,
      };
    case "Dotation amortissement":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "IM",
        debit: { fixe: "681300" },
        credit: {
          choix: [
            { code: "284410", label: "Amort. mobilier bureau" },
            { code: "284420", label: "Amort. matériel informatique" },
            { code: "284510", label: "Amort. matériel automobile" },
            { code: "284100", label: "Amort. matériel outillage" },
            { code: "282350", label: "Amort. aménagements bureaux" },
            { code: "281300", label: "Amort. immobilisations incorporelles" },
          ],
        },
        bslVisible: false,
      };
    case "Apurement avance terrain":
      return {
        typeOp: "OPERATIONS DIVERSES",
        journal: "OD",
        debit: {
          choix: [
            { code: "638401", label: "Perdiem" },
            { code: "638402", label: "Carburant mission" },
            { code: "638403", label: "Location véhicule mission" },
            { code: "638404", label: "Hébergement" },
            { code: "638405", label: "Restauration / repas" },
            { code: "638406", label: "Communication mission" },
            { code: "638410", label: "Autres frais mission" },
          ],
        },
        credit: { choix: ZONES_471 },
        bslVisible: true,
        avecSoldes: true,
      };
    case "Apurement avance salaire":
      return {
        typeOp: "OPERATIONS DIVERSES",
        journal: "OD",
        debit: { fixe: "422100" },
        credit: { fixe: "421100" },
        bslVisible: false,
        avecSoldes: true,
      };
    case "Cash transfer via avance":
      return {
        typeOp: "OPERATIONS DIVERSES",
        journal: "OD",
        debit: { fixe: "658100" },
        credit: { choix: ZONES_471 },
        bslVisible: true,
        avecSoldes: true,
      };
    case "Règlement fournisseur":
      return {
        typeOp: "TRESORERIE",
        journal: "BQ",
        debit: { fixe: "401100" },
        credit: { choix: BANQUES },
        bslVisible: true,
        avecSoldes: true,
      };
    case "Règlement prestataire":
      return {
        typeOp: "TRESORERIE",
        journal: "BQ",
        debit: { fixe: "401200" },
        credit: { choix: BANQUES },
        bslVisible: true,
        avecSoldes: true,
      };
    case "Avance comptable terrain":
      return {
        typeOp: "TRESORERIE",
        journal: "BQ",
        debit: { choix: ZONES_471 },
        credit: { choix: BANQUES },
        bslVisible: false,
      };
    case "Virement vers banque régionale":
      return {
        typeOp: "TRESORERIE",
        journal: "BQ",
        debit: { fixe: "585000" },
        credit: { choix: BANQUES },
        bslVisible: false,
      };
    case "Réception banque régionale":
      return {
        typeOp: "TRESORERIE",
        journal: "BQ",
        debit: {
          choix: [
            { code: "522100", label: "Banque régionale TOMBOUCTOU" },
            { code: "522200", label: "Banque régionale GAO" },
            { code: "522300", label: "Banque régionale SEGOU" },
            { code: "522400", label: "Banque régionale MOPTI" },
            { code: "522500", label: "Banque régionale SIKASSO" },
          ],
        },
        credit: { fixe: "585000" },
        bslVisible: false,
      };
    case "ICR / Frais admin vers AMSODE":
      return {
        typeOp: "TRESORERIE",
        journal: "BQ",
        debit: { fixe: "585000" },
        credit: { choix: BANQUES },
        bslVisible: false,
      };
    case "Net personnel":
      return {
        typeOp: "TRESORERIE",
        journal: "BQ",
        debit: { fixe: "422100" },
        credit: { choix: BANQUES },
        bslVisible: true,
        avecSoldes: true,
        multiSelect: true,
      };
    case "Reversement INPS":
      return {
        typeOp: "TRESORERIE",
        journal: "BQ",
        debit: { fixe: "431100" },
        credit: { choix: BANQUES },
        bslVisible: true,
        avecSoldes: true,
        multiSelect: true,
      };
    case "Reversement DGI ITS/TL":
      return {
        typeOp: "TRESORERIE",
        journal: "BQ",
        debit: {
          choix: [
            { code: "447100", label: "IGR — Impôt général sur le revenu" },
            { code: "447200", label: "ITS — Impôt sur traitements et salaires" },
            { code: "447300", label: "Taxe sur appointements et salaires" },
          ],
        },
        credit: { choix: BANQUES },
        bslVisible: true,
        avecSoldes: true,
        multiSelect: true,
      };
    case "Cash transfer direct":
      return {
        typeOp: "TRESORERIE",
        journal: "BQ",
        debit: { fixe: "658100" },
        credit: { choix: [...BANQUES, ...ZONES_471] },
        bslVisible: true,
      };
    case "Réception fonds bailleur":
      return {
        typeOp: "TRESORERIE",
        journal: "BQ",
        debit: { choix: BANQUES },
        credit: { fixe: "458111" },
        bslVisible: false,
        avecSoldes: true,
      };
    case "Avance sur salaire":
      return {
        typeOp: "TRESORERIE",
        journal: "BQ",
        debit: { fixe: "421100" },
        credit: { choix: BANQUES },
        bslVisible: false,
      };
    case "Paiement caisse":
      return {
        typeOp: "TRESORERIE",
        journal: "CS",
        debit: {
          choix: [
            { code: "601100", label: "Fournitures bureau" },
            { code: "638401", label: "Perdiem" },
            { code: "638402", label: "Carburant" },
            { code: "638405", label: "Restauration" },
          ],
        },
        credit: { fixe: "571000" },
        bslVisible: true,
      };
    case "Vente de biens":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "VT",
        debit: { fixe: "411000" },
        credit: { fixe: "701000" },
        bslVisible: false,
      };
    case "Vente de services":
      return {
        typeOp: "PRISE EN CHARGE",
        journal: "VT",
        debit: { fixe: "411000" },
        credit: { fixe: "702000" },
        bslVisible: false,
      };
    default:
      return null;
  }
}
