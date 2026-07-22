// Colonnes exactes de la table Supabase budget_lines (equivalent DATABASE
// de FIMS Excel), verifiees dans le code VBA reel de synchronisation des
// caches - ne pas inventer d'autres noms/ordre. project_id est resolu
// automatiquement depuis le projet cible choisi a l'import, jamais lu du
// fichier Excel.
export type BudgetImportKey =
  | "code_1"
  | "icp"
  | "budget_line"
  | "our_line_code"
  | "description"
  | "rubrique"
  | "categorie"
  | "unit"
  | "quantity"
  | "frequence"
  | "unit_cost"
  | "total_cost"
  | "ajustement"
  | "note"
  | "t_pec"
  | "unit_cost_devise";

export type BudgetImportColumn = {
  key: BudgetImportKey;
  header: string;
  type: "text" | "number";
  required?: boolean;
};

export const BUDGET_IMPORT_COLUMNS: BudgetImportColumn[] = [
  { key: "code_1", header: "CODE - 1", type: "text" },
  { key: "icp", header: "ICP", type: "text" },
  { key: "budget_line", header: "BUDGET LINE", type: "text" },
  { key: "our_line_code", header: "OUR LINE CODE", type: "text", required: true },
  { key: "description", header: "DESCRIPTION", type: "text" },
  { key: "rubrique", header: "Rubrique", type: "text" },
  { key: "categorie", header: "Categorie", type: "text" },
  { key: "unit", header: "Unit", type: "text" },
  { key: "quantity", header: "Quantity", type: "number" },
  { key: "frequence", header: "Frequence", type: "number" },
  { key: "unit_cost", header: "Unit Cost", type: "number" },
  { key: "total_cost", header: "Total Cost", type: "number" },
  { key: "ajustement", header: "Ajustement", type: "number" },
  { key: "note", header: "Note", type: "text" },
  { key: "t_pec", header: "T-PEC", type: "text" },
  { key: "unit_cost_devise", header: "Unit Cost/DEVISE", type: "number" },
];

export const BUDGET_EXAMPLE_ROW: Record<BudgetImportKey, string | number> = {
  code_1: "A.1",
  icp: "IC1",
  budget_line: "A.1",
  our_line_code: "A.1",
  description: "Targeting of beneficiary households",
  rubrique: "Activity",
  categorie: "A",
  unit: "Household",
  quantity: 500,
  frequence: 1,
  unit_cost: 2000,
  total_cost: 1000000,
  ajustement: 0,
  note: "",
  t_pec: "100%",
  unit_cost_devise: "",
};

export type BudgetImportRow = {
  rowNumber: number;
  values: Record<BudgetImportKey, string | number | null>;
  errors: string[];
};

function normaliserEnTete(s: string) {
  return s.trim().toLowerCase().replace(/[\s/_-]+/g, "");
}

// Mappe les en-tetes du fichier Excel vers les cles Supabase en comparant
// le texte (pas la position), pour tolerer un leger reordonnancement des
// colonnes par l'utilisateur.
export function mapperEntetes(enTetesFichier: string[]): (BudgetImportKey | null)[] {
  const cibles = BUDGET_IMPORT_COLUMNS.map((c) => ({
    key: c.key,
    norm: normaliserEnTete(c.header),
  }));
  return enTetesFichier.map((entete) => {
    const norm = normaliserEnTete(String(entete ?? ""));
    const trouve = cibles.find((c) => c.norm === norm);
    return trouve ? trouve.key : null;
  });
}

export function estNumeriqueOuVide(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return true;
  return typeof v === "number" || (typeof v === "string" && !isNaN(Number(v.trim())));
}

export function validerLignes(
  rawRows: Record<string, unknown>[],
  colonnesTrouvees: BudgetImportKey[],
  ourLineCodesExistants: Set<string>
): BudgetImportRow[] {
  const vusDansFichier = new Map<string, number>();

  return rawRows.map((raw, i) => {
    const rowNumber = i + 2; // ligne 1 = en-tete
    const values: Record<string, string | number | null> = {};
    const errors: string[] = [];

    for (const col of BUDGET_IMPORT_COLUMNS) {
      const present = colonnesTrouvees.includes(col.key);
      const brut = present ? raw[col.key] : undefined;
      if (brut === undefined || brut === null || brut === "") {
        values[col.key] = null;
        continue;
      }
      if (col.type === "number") {
        if (!estNumeriqueOuVide(brut)) {
          errors.push(`${col.header} : doit être numérique.`);
          values[col.key] = null;
        } else {
          values[col.key] = brut === "" ? null : Number(brut);
        }
      } else {
        values[col.key] = String(brut).trim();
      }
    }

    const ourLineCode = values.our_line_code as string | null;
    if (!ourLineCode || !ourLineCode.trim()) {
      errors.push("OUR LINE CODE est obligatoire.");
    } else {
      const norm = ourLineCode.trim().toUpperCase();
      if (vusDansFichier.has(norm)) {
        errors.push(
          `OUR LINE CODE "${ourLineCode}" en double dans le fichier (ligne ${vusDansFichier.get(norm)}).`
        );
      } else {
        vusDansFichier.set(norm, rowNumber);
      }
      if (ourLineCodesExistants.has(norm)) {
        errors.push(`OUR LINE CODE "${ourLineCode}" existe déjà dans ce projet.`);
      }
    }

    return { rowNumber, values: values as BudgetImportRow["values"], errors };
  });
}
