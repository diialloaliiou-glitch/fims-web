// Determine which bank/caisse account (chart_of_accounts root "5") a
// treasury piece actually moves money through. A piece can legitimately
// use any of the project's bank accounts (521100, 521200, 522100-522500,
// caisse 571000...) - the balance/sequencing check must follow THAT
// specific account, never assume a single hardcoded one, otherwise a
// piece paid from one bank gets compared against a totally unrelated
// bank's history (false "previous piece" warnings).
export function compteBanquePiece(
  lignes: { compte_debit: string | null; compte_credit: string | null }[]
): string | null {
  const comptes = new Set<string>();
  lignes.forEach((l) => {
    if (l.compte_debit?.startsWith("5")) comptes.add(l.compte_debit);
    if (l.compte_credit?.startsWith("5")) comptes.add(l.compte_credit);
  });
  return comptes.size === 1 ? Array.from(comptes)[0] : null;
}
