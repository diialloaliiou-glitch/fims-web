import { supabase } from "./supabase";
import { scopeToProjectSpending } from "./project-scope";
import type { Project } from "./types";

// Reproduit DATA!Z3 "CUMUL AVANCE" du fichier BASE Excel :
// =SUMIF(JDEPENSE[C], 458111, JDEPENSE[MT C]) — cumul des fonds recus du
// bailleur (credit du compte 458111 "Demande de fonds emise").
export async function cumulAvanceRecue(project: Pick<Project, "id" | "code_projet">) {
  const { data } = await scopeToProjectSpending(
    supabase.from("journal_entries").select("montant_credit").eq("compte_credit", "458111"),
    project
  );
  return (data ?? []).reduce(
    (s: number, e: { montant_credit: number }) => s + e.montant_credit,
    0
  );
}
