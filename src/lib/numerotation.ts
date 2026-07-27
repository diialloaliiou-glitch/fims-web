import { supabase } from "./supabase";

// Reproduit le mecanisme deja en place dans Saisie : N°E-J/N°Piece sont des
// compteurs MAX+1 par projet (et par prefixe de journal pour le N°E-J),
// formates "PREFIXE-0000".
export async function nextSequence(
  projectId: string,
  column: "n_ecriture_journal" | "n_piece",
  prefix: string
) {
  const { data } = await supabase
    .from("journal_entries")
    .select(column)
    .eq("project_id", projectId)
    .like(column, `${prefix}-%`);

  let max = 0;
  (data ?? []).forEach((row: Record<string, string | null>) => {
    const val = row[column];
    if (!val) return;
    const num = parseInt(val.split("-").pop() ?? "0", 10);
    if (!isNaN(num) && num > max) max = num;
  });

  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

// Pour une generation en lot (ex: prise en charge salaire), plusieurs N°E-J/
// N°Piece peuvent etre necessaires dans le meme batch avant le premier
// insert - nextSequence() seul re-interrogerait la meme valeur puisque rien
// n'est encore en base. Ce sequenceur pre-charge le max courant une seule
// fois par prefixe puis incremente en memoire.
export function makeBatchSequencer(projectId: string) {
  const maxParPrefixe = new Map<string, number>();

  async function chargerMax(column: "n_ecriture_journal" | "n_piece", prefix: string) {
    const cle = `${column}:${prefix}`;
    if (maxParPrefixe.has(cle)) return;
    const { data } = await supabase
      .from("journal_entries")
      .select(column)
      .eq("project_id", projectId)
      .like(column, `${prefix}-%`);
    let max = 0;
    (data ?? []).forEach((row: Record<string, string | null>) => {
      const val = row[column];
      if (!val) return;
      const num = parseInt(val.split("-").pop() ?? "0", 10);
      if (!isNaN(num) && num > max) max = num;
    });
    maxParPrefixe.set(cle, max);
  }

  return {
    async next(column: "n_ecriture_journal" | "n_piece", prefix: string) {
      await chargerMax(column, prefix);
      const cle = `${column}:${prefix}`;
      const suivant = (maxParPrefixe.get(cle) ?? 0) + 1;
      maxParPrefixe.set(cle, suivant);
      return `${prefix}-${String(suivant).padStart(4, "0")}`;
    },
  };
}
