import { supabase } from "./supabase";

// Reproduit EstPeriodeCloturee(Now) du FIMS VBA d'origine : bloque la
// saisie si le MOIS EN COURS (pas la date de l'écriture) est clôturé,
// ou si l'ANNÉE en cours est clôturée.
export async function periodeCouranteFermee(
  projectId: string
): Promise<string | null> {
  const now = new Date();
  const moisCourant = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const anneeCourante = String(now.getFullYear());

  const { data } = await supabase
    .from("period_closures")
    .select("type, periode, statut")
    .eq("project_id", projectId)
    .eq("statut", "CLOTUREE")
    .in("periode", [moisCourant, anneeCourante]);

  const moisFerme = (data ?? []).find(
    (c) => c.type === "MENSUELLE" && c.periode === moisCourant
  );
  if (moisFerme) {
    return `Impossible de valider : la période en cours (${moisCourant}) est clôturée.`;
  }

  const anneeFermee = (data ?? []).find(
    (c) => c.type === "ANNUELLE" && c.periode === anneeCourante
  );
  if (anneeFermee) {
    return `Impossible de valider : l'année en cours (${anneeCourante}) est clôturée.`;
  }

  return null;
}
