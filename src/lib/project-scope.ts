import type { Project } from "./types";

// Filtre a appliquer sur journal_entries pour tout calcul de "depense reelle"
// / consommation budgetaire specifique a un projet (Financial Report,
// Reporting...). Necessaire en plus de project_id : les donnees historiques
// migrees en vrac (World Renew) partagent toutes le meme project_id
// Supabase, mais seule une partie porte le tag_projet_local du projet reel —
// l'autre partie n'a jamais ete rattachee a une ligne budgetaire (b_s_line
// vide) et ne doit pas compter dans ces calculs, malgre le meme project_id.
// Note : le typage générique du query builder Supabase (PostgrestFilterBuilder)
// fait exploser l'inférence TypeScript sur des chaînes .eq() successives ;
// on accepte donc `any` ici plutôt que de propager ce type très imbriqué.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopeToProjectSpending(query: any, project: Pick<Project, "id" | "code_projet">): any {
  return query.eq("project_id", project.id).eq("tag_projet_local", project.code_projet);
}

// Meme filtre que scopeToProjectSpending, mais pour plusieurs projets a la
// fois (KPI organisationnel) : chaque projet garde sa propre paire
// project_id+tag_projet_local, jamais un simple .in("project_id", ids) qui
// perdrait la garde tag_projet_local par-projet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopeToProjectsSpending(
  query: any,
  projects: Pick<Project, "id" | "code_projet">[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (projects.length === 0) return query.eq("project_id", "__none__");
  const clause = projects
    .map((p) => `and(project_id.eq.${p.id},tag_projet_local.eq.${p.code_projet})`)
    .join(",");
  return query.or(clause);
}
