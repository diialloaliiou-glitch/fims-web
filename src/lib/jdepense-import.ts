// Outil de MIGRATION TEMPORAIRE depuis l'ancien FIMS Excel (feuille JOURNAL
// DES DEPENSES / tableau JDEPENSE) vers journal_entries. A retirer une fois
// toutes les anciennes bases chargees - ne pas melanger avec le flux normal
// de saisie (ecran Saisie), qui reste inchange et independant de ce fichier.
export type JdepenseImportKey =
  | "index_source"
  | "date_operation"
  | "tag_projet_local"
  | "budget_line"
  | "categorie"
  | "type_operation"
  | "b_s_line"
  | "journal"
  | "n_ecriture_journal"
  | "compte_debit"
  | "compte_credit"
  | "tiers"
  | "ref_fact_d"
  | "n_cheque_ov"
  | "n_lettrage"
  | "n_piece"
  | "zone_code"
  | "montant_debit"
  | "montant_credit"
  | "libelle"
  | "idc"
  | "date_heure_saisie"
  | "utilisateur";

export type JdepenseImportColumn = {
  key: JdepenseImportKey;
  header: string;
  type: "text" | "number" | "date";
  required?: boolean;
};

// Ordre exact des 23 colonnes du vrai tableau JDEPENSE - ne pas reordonner,
// ne pas en inventer d'autres.
export const JDEPENSE_IMPORT_COLUMNS: JdepenseImportColumn[] = [
  { key: "index_source", header: "Index", type: "text" },
  { key: "date_operation", header: "DATE", type: "date", required: true },
  { key: "tag_projet_local", header: "PROJECT ID", type: "text" },
  { key: "budget_line", header: "BUDGET LINE", type: "text" },
  { key: "categorie", header: "CATEGORIE", type: "text" },
  { key: "type_operation", header: "TYPE D'OPERATION", type: "text" },
  { key: "b_s_line", header: "B-S-LINE", type: "text" },
  { key: "journal", header: "JOURNAL", type: "text" },
  { key: "n_ecriture_journal", header: "N°E-J", type: "text", required: true },
  { key: "compte_debit", header: "D", type: "text" },
  { key: "compte_credit", header: "C", type: "text" },
  { key: "tiers", header: "TIERS", type: "text" },
  { key: "ref_fact_d", header: "REF. FACT/D", type: "text" },
  { key: "n_cheque_ov", header: "N°/CHQ/OV", type: "text" },
  { key: "n_lettrage", header: "N°Ltr", type: "text" },
  { key: "n_piece", header: "N°PIECE", type: "text", required: true },
  { key: "zone_code", header: "ZONE", type: "text" },
  { key: "montant_debit", header: "MT D", type: "number" },
  { key: "montant_credit", header: "MT C", type: "number" },
  { key: "libelle", header: "Libellé", type: "text", required: true },
  { key: "idc", header: "IDC", type: "text" },
  { key: "date_heure_saisie", header: "Date/Heure Saisie", type: "date" },
  { key: "utilisateur", header: "Utilisateur", type: "text" },
];

export const JDEPENSE_EXAMPLE_ROW: Record<JdepenseImportKey, string | number> = {
  index_source: 1,
  date_operation: "19/07/2026",
  tag_projet_local: "",
  budget_line: "A.1",
  categorie: "AC",
  type_operation: "PRISE EN CHARGE",
  b_s_line: "A.1",
  journal: "AC",
  n_ecriture_journal: "AC-0001",
  compte_debit: "601100",
  compte_credit: "",
  tiers: "FOURNISSEUR X",
  ref_fact_d: "F-001",
  n_cheque_ov: "",
  n_lettrage: "",
  n_piece: "PC-0001",
  zone_code: "BAMAKO",
  montant_debit: 10000,
  montant_credit: "",
  libelle: "Exemple de libelle",
  idc: "7_2026",
  date_heure_saisie: "19/07/2026 10:00",
  utilisateur: "MIGRATION",
};

export type JdepenseImportRow = {
  rowNumber: number;
  values: Record<JdepenseImportKey, string | number | null>;
  dateOperationIso: string | null;
  dateHeureSaisieIso: string | null;
  zoneId: number | null;
  errors: string[];
};

export function normaliserEnTeteJdepense(s: string) {
  return s.trim().toLowerCase().replace(/[\s/.°'’_-]+/g, "");
}

export function mapperEntetesJdepense(enTetesFichier: string[]): (JdepenseImportKey | null)[] {
  const cibles = JDEPENSE_IMPORT_COLUMNS.map((c) => ({
    key: c.key,
    norm: normaliserEnTeteJdepense(c.header),
  }));
  return enTetesFichier.map((entete) => {
    const norm = normaliserEnTeteJdepense(String(entete ?? ""));
    const trouve = cibles.find((c) => c.norm === norm);
    return trouve ? trouve.key : null;
  });
}

export function estNumeriqueOuVideJdepense(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return true;
  return typeof v === "number" || (typeof v === "string" && !isNaN(Number(v.trim())));
}

// Excel peut fournir soit un objet Date (si le classeur est lu avec
// cellDates:true et que la cellule est un vrai type date Excel), soit du
// texte (si la colonne a ete exportee/saisie en texte). Les codes de compte
// eux ne passent JAMAIS par cette fonction et restent des chaines brutes -
// piege deja rencontre : ne jamais convertir un code de compte en nombre.
export function parserDateSouple(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "number" && isFinite(v)) {
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + v * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string" && v.trim()) {
    const s = v.trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      const [, d, mo, y, h, mi, se] = m;
      const dt = new Date(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(h ?? 0),
        Number(mi ?? 0),
        Number(se ?? 0)
      );
      if (!isNaN(dt.getTime())) return dt;
    }
    const iso = new Date(s);
    if (!isNaN(iso.getTime())) return iso;
  }
  return null;
}

function dateSeulementIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Valide chaque ligne (regles locales : exclusivite D/C, exclusivite MT
// D/MT C, dates valides, champs obligatoires) puis resout compte/zone
// contre les tables de reference passees en parametre (jamais devine
// localement), et enfin verifie l'equilibre Debit=Credit par N°E-J sur
// l'ensemble du fichier.
export function validerLignesJdepense(
  rawRows: Record<string, unknown>[],
  colonnesTrouvees: JdepenseImportKey[],
  comptesValides: Set<string>,
  zonesInfo: Map<string, number>
): JdepenseImportRow[] {
  const lignes: JdepenseImportRow[] = rawRows.map((raw, i) => {
    const rowNumber = i + 2;
    const values: Record<string, string | number | null> = {};
    const errors: string[] = [];

    for (const col of JDEPENSE_IMPORT_COLUMNS) {
      const present = colonnesTrouvees.includes(col.key);
      const brut = present ? raw[col.key] : undefined;

      if (col.type === "date") {
        values[col.key] = brut == null || brut === "" ? null : String(brut);
        continue;
      }

      if (brut === undefined || brut === null || brut === "") {
        values[col.key] = null;
        continue;
      }
      if (col.type === "number") {
        if (!estNumeriqueOuVideJdepense(brut)) {
          errors.push(`${col.header} : doit être numérique.`);
          values[col.key] = null;
        } else {
          values[col.key] = Number(brut);
        }
      } else {
        // Code de compte / zone / texte libre - toujours une chaine, jamais
        // une conversion numerique (perte de zero non significatif sinon).
        values[col.key] = String(brut).trim();
      }
    }

    for (const champ of ["n_ecriture_journal", "n_piece", "libelle"] as const) {
      if (!values[champ]) {
        errors.push(`${JDEPENSE_IMPORT_COLUMNS.find((c) => c.key === champ)?.header} est obligatoire.`);
      }
    }

    // Exclusivite D/C : exactement une des deux colonnes remplie.
    const dRempli = !!values.compte_debit;
    const cRempli = !!values.compte_credit;
    if (dRempli && cRempli) {
      errors.push("D et C sont tous les deux remplis - une seule moitié d'écriture par ligne.");
    } else if (!dRempli && !cRempli) {
      errors.push("D et C sont tous les deux vides - un compte débité ou crédité est obligatoire.");
    }

    // Exclusivite MT D/MT C : meme regle sur les montants.
    const mtD = (values.montant_debit as number | null) ?? 0;
    const mtC = (values.montant_credit as number | null) ?? 0;
    if (mtD > 0 && mtC > 0) {
      errors.push("MT D et MT C sont tous les deux renseignés - un seul montant par ligne.");
    } else if (mtD === 0 && mtC === 0) {
      errors.push("MT D et MT C sont tous les deux vides ou nuls.");
    }

    // Comptes verifies contre chart_of_accounts (jamais devine localement).
    if (dRempli && !comptesValides.has(values.compte_debit as string)) {
      errors.push(`Compte D "${values.compte_debit}" introuvable dans le plan comptable du projet.`);
    }
    if (cRempli && !comptesValides.has(values.compte_credit as string)) {
      errors.push(`Compte C "${values.compte_credit}" introuvable dans le plan comptable du projet.`);
    }

    // Zone verifiee contre zones.code - resolue en zone_id, jamais devinee.
    let zoneId: number | null = null;
    const zoneCode = values.zone_code as string | null;
    if (zoneCode) {
      const found = zonesInfo.get(zoneCode.toUpperCase());
      if (found === undefined) {
        errors.push(`Zone "${zoneCode}" introuvable.`);
      } else {
        zoneId = found;
      }
    }

    // Dates
    const dateOp = parserDateSouple(values.date_operation);
    if (!values.date_operation) {
      errors.push("DATE est obligatoire.");
    } else if (!dateOp) {
      errors.push(`DATE "${values.date_operation}" invalide.`);
    }

    let dateHeureSaisieIso: string | null = null;
    if (values.date_heure_saisie) {
      const dhs = parserDateSouple(values.date_heure_saisie);
      if (!dhs) {
        errors.push(`Date/Heure Saisie "${values.date_heure_saisie}" invalide.`);
      } else {
        dateHeureSaisieIso = dhs.toISOString();
      }
    }

    return {
      rowNumber,
      values: values as JdepenseImportRow["values"],
      dateOperationIso: dateOp ? dateSeulementIso(dateOp) : null,
      dateHeureSaisieIso,
      zoneId,
      errors,
    };
  });

  // Equilibre Debit=Credit par N°E-J sur tout le fichier - n'empeche pas les
  // autres ecritures d'etre importees, mais rejette celle-ci precisement.
  const parNej = new Map<string, { debit: number; credit: number; lignes: JdepenseImportRow[] }>();
  lignes.forEach((l) => {
    const nej = (l.values.n_ecriture_journal as string | null)?.trim();
    if (!nej) return;
    if (!parNej.has(nej)) parNej.set(nej, { debit: 0, credit: 0, lignes: [] });
    const grp = parNej.get(nej)!;
    grp.debit += (l.values.montant_debit as number | null) ?? 0;
    grp.credit += (l.values.montant_credit as number | null) ?? 0;
    grp.lignes.push(l);
  });
  parNej.forEach((grp, nej) => {
    if (Math.round(grp.debit * 100) !== Math.round(grp.credit * 100)) {
      grp.lignes.forEach((l) =>
        l.errors.push(
          `Écriture "${nej}" déséquilibrée : total débit ${grp.debit} ≠ total crédit ${grp.credit}.`
        )
      );
    }
  });

  return lignes;
}
