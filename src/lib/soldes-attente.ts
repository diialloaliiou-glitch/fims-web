import { supabase } from "@/lib/supabase";
import type { Project, JournalEntry } from "@/lib/types";

export type SoldeEnAttente = {
  compte: string;
  tiers: string;
  numPiece: string;
  dateOp: string;
  soldeNet: number;
  bsl: string;
  zoneId: number | null;
  refChq: string;
  libelle: string;
};

// Reproduit LireSoldesClasse4() de mod_ModeleEcriture.bas : regroupe les
// ecritures par (compte classe 4, n_piece), garde les groupes dont le solde
// net (debit - credit) depasse 0.01 en valeur absolue, et prend le
// tiers/BSL/zone/reference/libelle de l'ecriture la plus recente du groupe.
// Exclut 471202 (compte groupe<->projet, jamais une avance a apurer).
function estClasse4(compte: string | null): boolean {
  if (!compte) return false;
  const c = compte.trim();
  if (!c) return false;
  if (!c.startsWith("4")) return false;
  if (c === "471202") return false;
  return true;
}

export async function soldesEnAttente(project: Project): Promise<SoldeEnAttente[]> {
  const { data } = await supabase
    .from("journal_entries")
    .select(
      "compte_debit, compte_credit, montant_debit, montant_credit, tiers, n_piece, date_operation, b_s_line, zone_id, n_cheque_ov, libelle"
    )
    .eq("project_id", project.id);

  const entries = (data as Pick<
    JournalEntry,
    | "compte_debit"
    | "compte_credit"
    | "montant_debit"
    | "montant_credit"
    | "tiers"
    | "n_piece"
    | "date_operation"
    | "b_s_line"
    | "zone_id"
    | "n_cheque_ov"
    | "libelle"
  >[]) ?? [];

  type Groupe = {
    compte: string;
    numPiece: string;
    debit: number;
    credit: number;
    tiers: string;
    dateOp: string;
    bsl: string;
    zoneId: number | null;
    refChq: string;
    libelle: string;
  };

  const groupes = new Map<string, Groupe>();

  function accumuler(compte: string, montantD: number, montantC: number, e: (typeof entries)[number]) {
    const pce = e.n_piece ?? "";
    const key = `${compte}|${pce}`;
    let g = groupes.get(key);
    if (!g) {
      g = {
        compte,
        numPiece: pce,
        debit: 0,
        credit: 0,
        tiers: "",
        dateOp: "1900-01-01",
        bsl: "",
        zoneId: null,
        refChq: "",
        libelle: "",
      };
      groupes.set(key, g);
    }
    g.debit += montantD;
    g.credit += montantC;
    if (e.date_operation >= g.dateOp) {
      g.dateOp = e.date_operation;
      g.tiers = e.tiers ?? "";
      g.bsl = e.b_s_line ?? "";
      g.zoneId = e.zone_id;
      g.refChq = e.n_cheque_ov ?? "";
      g.libelle = e.libelle ?? "";
    }
  }

  entries.forEach((e) => {
    if (estClasse4(e.compte_debit)) accumuler(e.compte_debit as string, e.montant_debit, 0, e);
    if (estClasse4(e.compte_credit)) accumuler(e.compte_credit as string, 0, e.montant_credit, e);
  });

  const soldes: SoldeEnAttente[] = [];
  groupes.forEach((g) => {
    const net = g.debit - g.credit;
    if (Math.abs(net) > 0.01) {
      soldes.push({
        compte: g.compte,
        tiers: g.tiers,
        numPiece: g.numPiece,
        dateOp: g.dateOp,
        soldeNet: net,
        bsl: g.bsl,
        zoneId: g.zoneId,
        refChq: g.refChq,
        libelle: g.libelle,
      });
    }
  });

  return soldes.sort((a, b) => a.compte.localeCompare(b.compte));
}
