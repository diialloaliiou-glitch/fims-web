// Seuils visuels du % de consommation (sain/ambre/rouge), partages entre
// BUD TRACKER et le Dashboard - une seule source de verite pour ne pas
// desynchroniser les seuils entre les deux ecrans.
export type NiveauTaux = "teal" | "amber" | "red";

export function niveauTaux(pct: number): NiveauTaux {
  if (pct > 1) return "red";
  if (pct >= 0.8) return "amber";
  return "teal";
}

const TAUX_TEXT_CLASS: Record<NiveauTaux, string> = {
  teal: "text-accent-teal",
  amber: "text-accent-amber",
  red: "text-accent-red",
};

export function couleurTauxClass(pct: number): string {
  return TAUX_TEXT_CLASS[niveauTaux(pct)];
}
