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
