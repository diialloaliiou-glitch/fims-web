import { supabase } from "./supabase";
import type { ChartOfAccount, Project } from "./types";

// Le plan comptable est desormais propriete de l'organisation
// (chart_of_accounts.organization_id), plus du projet. Ce qui reste propre
// au projet est son "habillage local" dans project_accounts : le compte
// est-il actif sur ce projet, et son libelle est-il surcharge. Ce helper
// centralise la resolution (evite de repeter le join dans chaque ecran).
export type CompteEffectif = ChartOfAccount & { actif: boolean };

export async function chargerComptesEffectifs(
  project: Project
): Promise<CompteEffectif[]> {
  const [{ data: comptes }, { data: overrides }] = await Promise.all([
    supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("organization_id", project.organization_id)
      .order("ccompte"),
    supabase
      .from("project_accounts")
      .select("ccompte, actif, libelle_local")
      .eq("project_id", project.id),
  ]);

  const overrideParCode = new Map(
    (overrides ?? []).map((o) => [o.ccompte, o])
  );

  return (comptes ?? []).map((c) => {
    const o = overrideParCode.get(c.ccompte);
    return {
      ...c,
      libelle: o?.libelle_local ?? c.libelle,
      actif: o?.actif ?? true,
    };
  });
}
