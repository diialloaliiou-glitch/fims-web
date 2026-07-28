import { supabase } from "./supabase";
import { scopeToProjectsSpending } from "./project-scope";
import type { BudgetLine, Project, Zone } from "./types";

export type ProjetKpi = Pick<
  Project,
  "id" | "code_projet" | "nom_projet" | "organization_id" | "compte_reception_fonds"
>;

function moisVide() {
  return Array.from({ length: 12 }, () => 0);
}

export type LigneDepenseKpi = {
  project_id: string;
  mois: number; // 1-12
  montant: number;
  budgetLine: BudgetLine | null;
  zone_id: number | null;
};

// Reproduit calculerDepenseReelle() (Reporting/Financial Report) mais
// consolide sur plusieurs projets a la fois : b_s_line n'a de sens que dans
// SON projet (nombreux projets partagent des codes identiques), donc chaque
// ligne est resolue via la cle (project_id, b_s_line) - jamais b_s_line seul.
export async function chargerDonneesKpi(projects: ProjetKpi[], annee: number) {
  const projectIds = projects.map((p) => p.id);
  if (projectIds.length === 0)
    return { budgetLines: [] as BudgetLine[], lignes: [] as LigneDepenseKpi[], depenseTotaleCumulee: 0 };

  const [budgetLinesRes, entriesRes] = await Promise.all([
    supabase.from("budget_lines").select("*").in("project_id", projectIds).neq("our_line_code", "52B"),
    scopeToProjectsSpending(
      supabase.from("journal_entries").select("project_id, b_s_line, compte_debit, montant_debit, zone_id, idc"),
      projects
    ),
  ]);

  const budgetLines = (budgetLinesRes.data as BudgetLine[]) ?? [];
  const entriesRaw =
    (entriesRes.data as {
      project_id: string;
      b_s_line: string | null;
      compte_debit: string | null;
      montant_debit: number;
      zone_id: number | null;
      idc: string | null;
    }[]) ?? [];

  const budgetLineParClef = new Map<string, BudgetLine>();
  budgetLines.forEach((b) => {
    if (!b.our_line_code) return;
    budgetLineParClef.set(`${b.project_id}|${b.our_line_code.toUpperCase()}`, b);
  });

  const lignes: LigneDepenseKpi[] = [];
  // depenseTotaleCumulee = depuis toujours (aucune restriction d'annee) -
  // sert de base au taux de consommation global, qui doit se lire comme un
  // taux d'utilisation du stock de fonds recus depuis le debut du projet,
  // pas un ratio de flux d'une seule annee civile (un bailleur peut verser
  // en annee N et le projet depense sur plusieurs mois qui debordent sur
  // N+1, ce qui fausserait un ratio calcule annee par annee).
  let depenseTotaleCumulee = 0;
  entriesRaw.forEach((e) => {
    if (!e.montant_debit || !e.idc) return;
    const compteD = e.compte_debit ?? "";
    if (compteD.startsWith("5") || compteD.startsWith("411")) return;
    const bsl = (e.b_s_line ?? "").toUpperCase();
    if (!bsl) return;
    const budgetLine = budgetLineParClef.get(`${e.project_id}|${bsl}`) ?? null;
    if (!budgetLine) return;

    depenseTotaleCumulee += e.montant_debit;

    const [moisStr, anneeStr] = e.idc.split("_");
    if (anneeStr !== String(annee)) return;
    const mois = parseInt(moisStr, 10);
    if (isNaN(mois) || mois < 1 || mois > 12) return;
    lignes.push({ project_id: e.project_id, mois, montant: e.montant_debit, budgetLine, zone_id: e.zone_id });
  });

  return { budgetLines, lignes, depenseTotaleCumulee };
}

export function budgetTotalAnnuel(budgetLines: BudgetLine[]) {
  return budgetLines.reduce((s, b) => s + (b.total_cost ?? 0), 0);
}

export function consommationMensuelleCumulee(lignes: LigneDepenseKpi[]) {
  const parMois = moisVide();
  lignes.forEach((l) => {
    parMois[l.mois - 1] += l.montant;
  });
  const cumule = moisVide();
  let cumul = 0;
  parMois.forEach((v, i) => {
    cumul += v;
    cumule[i] = cumul;
  });
  return cumule;
}

// Rythme lineaire ideal = le budget approuve depense a parts egales chaque
// mois - reference de "bonne cadence", pas une simple mise a l'echelle du
// resultat reel.
export function rythmeLineaireIdeal(totalBudget: number) {
  return Array.from({ length: 12 }, (_, i) => (totalBudget * (i + 1)) / 12);
}

export type ResultatDimension = {
  nom: string;
  budget: number;
  depense: number;
  resultat: number;
  nbProjets: number;
};

// Excedent/deficit consolide par secteur ou par categorie : budget approuve
// (budget_lines) moins depense reelle (lignes filtrees par chargerDonneesKpi),
// regroupes par la valeur de ce champ sur la ligne budgetaire concernee.
export function resultatParDimension(
  budgetLines: BudgetLine[],
  lignes: LigneDepenseKpi[],
  dimension: "secteur" | "categorie"
): ResultatDimension[] {
  const parNom = new Map<string, { budget: number; depense: number; projets: Set<string> }>();

  budgetLines.forEach((b) => {
    const nom = (b[dimension] ?? "").trim();
    if (!nom) return;
    const entree = parNom.get(nom) ?? { budget: 0, depense: 0, projets: new Set<string>() };
    entree.budget += b.total_cost ?? 0;
    entree.projets.add(b.project_id);
    parNom.set(nom, entree);
  });

  lignes.forEach((l) => {
    const nom = (l.budgetLine?.[dimension] ?? "").trim();
    if (!nom) return;
    const entree = parNom.get(nom) ?? { budget: 0, depense: 0, projets: new Set<string>() };
    entree.depense += l.montant;
    entree.projets.add(l.project_id);
    parNom.set(nom, entree);
  });

  return Array.from(parNom.entries())
    .map(([nom, v]) => ({
      nom,
      budget: v.budget,
      depense: v.depense,
      resultat: v.budget - v.depense,
      nbProjets: v.projets.size,
    }))
    .sort((a, b) => Math.abs(b.resultat) - Math.abs(a.resultat));
}

export type ResultatRegion = { nom: string; montant: number; nbProjets: number };

// Pas une variance (aucun budget n'est ventile par zone) - une repartition
// de la depense reelle par zone, remontee a la zone parente si
// l'organisation a configure ce niveau "Region" optionnel.
export function repartitionParRegion(lignes: LigneDepenseKpi[], zones: Zone[]): ResultatRegion[] {
  const zoneParId = new Map(zones.map((z) => [z.id, z]));
  function zoneRacine(zoneId: number | null): Zone | null {
    if (zoneId == null) return null;
    const z = zoneParId.get(zoneId);
    if (!z) return null;
    if (z.parent_zone_id != null) return zoneParId.get(z.parent_zone_id) ?? z;
    return z;
  }

  const parNom = new Map<string, { montant: number; projets: Set<string> }>();
  lignes.forEach((l) => {
    const racine = zoneRacine(l.zone_id);
    const nom = racine?.code ?? "Non renseigné";
    const entree = parNom.get(nom) ?? { montant: 0, projets: new Set<string>() };
    entree.montant += l.montant;
    entree.projets.add(l.project_id);
    parNom.set(nom, entree);
  });

  return Array.from(parNom.entries())
    .map(([nom, v]) => ({ nom, montant: v.montant, nbProjets: v.projets.size }))
    .sort((a, b) => b.montant - a.montant);
}

export type FondsRecusResultat = {
  parProjet: { projectId: string; codeProjet: string; total: number }[];
  parMois: number[];
  total: number;
  projetsSansCompte: ProjetKpi[];
};

// Reception de fonds = compte_credit configure par projet (jamais un numero
// fige) - le compte differe d'un projet/pays a l'autre, d'ou la requete par
// projet plutot qu'un .in("project_id", ids) unique. Pas de filtre sur
// compte_debit : chaque ecriture est scindee en 2 LIGNES separees (une
// debit, une credit), donc compte_debit est toujours vide sur la ligne ou
// compte_credit est renseigne - meme convention que le calcul deja en place
// sur le Dashboard pour ce meme compte.
export async function fondsRecusEtCourbe(
  projects: ProjetKpi[],
  annee: number
): Promise<FondsRecusResultat> {
  const parMois = moisVide();
  const parProjet: FondsRecusResultat["parProjet"] = [];
  const projetsSansCompte: ProjetKpi[] = [];

  await Promise.all(
    projects.map(async (p) => {
      if (!p.compte_reception_fonds) {
        projetsSansCompte.push(p);
        return;
      }
      const { data } = await supabase
        .from("journal_entries")
        .select("montant_credit, date_operation")
        .eq("project_id", p.id)
        .eq("compte_credit", p.compte_reception_fonds)
        .gte("date_operation", `${annee}-01-01`)
        .lte("date_operation", `${annee}-12-31`);

      let totalProjet = 0;
      (data ?? []).forEach((r) => {
        const mois = parseInt(r.date_operation.slice(5, 7), 10) - 1;
        if (mois >= 0 && mois < 12) parMois[mois] += r.montant_credit;
        totalProjet += r.montant_credit;
      });
      parProjet.push({ projectId: p.id, codeProjet: p.code_projet, total: totalProjet });
    })
  );

  const total = parProjet.reduce((s, p) => s + p.total, 0);
  return { parProjet, parMois, total, projetsSansCompte };
}

// Base du taux de consommation global : cumul depuis toujours (aucun
// filtre d'annee), comme le fait deja le Dashboard pour son propre "Taux de
// conso de l'avance recue" par projet - un ratio annee par annee serait
// fausse par le decalage entre le versement d'une tranche et sa depense
// etalee sur plusieurs mois qui peuvent deborder sur l'annee suivante.
export async function fondsRecusTotalCumule(projects: ProjetKpi[]): Promise<number> {
  let total = 0;
  await Promise.all(
    projects.map(async (p) => {
      if (!p.compte_reception_fonds) return;
      const { data } = await supabase
        .from("journal_entries")
        .select("montant_credit")
        .eq("project_id", p.id)
        .eq("compte_credit", p.compte_reception_fonds);
      (data ?? []).forEach((r) => {
        total += r.montant_credit;
      });
    })
  );
  return total;
}

export function statutTauxKpi(pct: number): { color: "teal" | "amber" | "red"; label: string } {
  if (pct >= 0.85) return { color: "teal", label: "Sain" };
  if (pct >= 0.6) return { color: "amber", label: "À surveiller" };
  return { color: "red", label: "Critique" };
}
