import { supabase } from "@/lib/supabase";

// Un seul token par (n_piece, project_id) - idempotent : reimprimer la
// meme piece renvoie toujours le meme lien de verification.
export async function getOrCreateVerificationToken(
  nPiece: string,
  projectId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("payment_verifications")
    .select("id")
    .eq("n_piece", nPiece)
    .eq("project_id", projectId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("payment_verifications")
    .insert({ n_piece: nPiece, project_id: projectId })
    .select("id")
    .single();

  if (error) return null;
  return created.id;
}

export type PieceVerifiee = {
  n_piece: string;
  projet: string;
  montant: number;
  date_operation: string;
  tiers: string;
};

export async function verifierPiece(token: string): Promise<PieceVerifiee | null> {
  const { data, error } = await supabase.rpc("verifier_piece", { token });
  if (error || !data || data.length === 0) return null;
  return data[0] as PieceVerifiee;
}
