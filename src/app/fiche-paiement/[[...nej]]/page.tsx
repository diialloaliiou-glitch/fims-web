"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Home, Download, Printer, PenLine, BadgeCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PREFIXE_COMPTE_BANQUE_PROJET } from "@/lib/solde-banque";
import { getOrCreateVerificationToken } from "@/lib/verification-piece";
import type { BudgetLine, JournalEntry } from "@/lib/types";

// Palette propre a ce document imprimable (Fiche de Paiement) : noir/blanc
// avec quelques accents fixes. Volontairement independante des tokens de
// theme sombre/clair du reste de l'appli (cette page ne change jamais avec
// le theme ou la langue).
const BROWN = "#8B6D4E";
const DARK_GRAY = "#4B5563";

export default function FichePaiementPage() {
  const params = useParams<{ nej?: string[] }>();
  const router = useRouter();
  const { session, project, organization, loading: authLoading } = useAuth();

  const nejRoute = params.nej?.[0] ?? "";
  const [numEJInput, setNumEJInput] = useState(nejRoute);
  const [lignes, setLignes] = useState<JournalEntry[]>([]);
  const [budgetGlobal, setBudgetGlobal] = useState(0);
  const [soldeActuel, setSoldeActuel] = useState<number | null>(null);
  const [dernierNEJCompte, setDernierNEJCompte] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  useEffect(() => {
    setNumEJInput(nejRoute);
  }, [nejRoute]);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/login");
      return;
    }
    if (!project) {
      router.push("/choisir-projet");
    }
  }, [authLoading, session, project, router]);

  useEffect(() => {
    async function chargerFiche(nej: string) {
      setError(null);
      setLignes([]);
      setSoldeActuel(null);
      setDernierNEJCompte(null);
      if (!project || !nej.trim()) return;

      setLoading(true);

      const { data: lignesData } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("project_id", project.id)
        .eq("n_ecriture_journal", nej.trim())
        .eq("type_operation", "TRESORERIE")
        .order("id");

      const rows = (lignesData as JournalEntry[]) ?? [];

      if (rows.length === 0) {
        setLoading(false);
        setError(`No settlement (TRESORERIE) found for entry ${nej}.`);
        return;
      }

      setLignes(rows);

      const { data: budgetLinesData } = await supabase
        .from("budget_lines")
        .select("*")
        .eq("project_id", project.id);
      const total = ((budgetLinesData as BudgetLine[]) ?? []).reduce(
        (sum, l) => sum + (l.total_cost ?? 0),
        0
      );
      setBudgetGlobal(total);

      const { data: allTreso } = await supabase
        .from("journal_entries")
        .select(
          "compte_debit, compte_credit, montant_debit, montant_credit, n_ecriture_journal, date_heure_saisie"
        )
        .eq("project_id", project.id)
        .eq("type_operation", "TRESORERIE");

      let solde = 0;
      let dernier: { nej: string; date: string } | null = null;

      (allTreso ?? []).forEach((e) => {
        const surCompteD = (e.compte_debit ?? "").startsWith(PREFIXE_COMPTE_BANQUE_PROJET);
        const surCompteC = (e.compte_credit ?? "").startsWith(PREFIXE_COMPTE_BANQUE_PROJET);
        if (surCompteD) solde += e.montant_debit;
        if (surCompteC) solde -= e.montant_credit;

        if (surCompteD || surCompteC) {
          if (!dernier || e.date_heure_saisie >= dernier.date) {
            dernier = { nej: e.n_ecriture_journal ?? "", date: e.date_heure_saisie };
          }
        }
      });

      setSoldeActuel(solde);
      if (dernier && (dernier as { nej: string }).nej.toUpperCase() !== nej.trim().toUpperCase()) {
        setDernierNEJCompte((dernier as { nej: string }).nej);
      }

      setLoading(false);
    }

    chargerFiche(nejRoute);
  }, [nejRoute, project]);

  const montantDemande = lignes.reduce((sum, l) => sum + l.montant_credit, 0);
  const soldeDisponible = soldeActuel !== null ? soldeActuel + montantDemande : null;
  const soldeRestant = soldeActuel;
  const premiere = lignes[0];
  const estPieceAnterieure = dernierNEJCompte !== null;

  useEffect(() => {
    if (!premiere?.n_piece || !project || estPieceAnterieure) {
      setVerificationToken(null);
      return;
    }
    getOrCreateVerificationToken(premiere.n_piece, project.id).then(setVerificationToken);
  }, [premiere?.n_piece, project, estPieceAnterieure]);

  function goToPiece(value: string) {
    const clean = value.trim();
    if (!clean) return;
    router.push(`/fiche-paiement/${clean}`);
  }

  if (authLoading || !session || !project) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <div className="flex min-h-screen bg-white text-black">
      <div className="flex w-14 shrink-0 flex-col items-center gap-6 bg-slate-800 py-6 print:hidden">
        <button
          onClick={() => router.push("/")}
          aria-label="Home"
          className="text-slate-300 hover:text-white"
        >
          <Home className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <button
          onClick={() => window.print()}
          aria-label="Download"
          className="text-slate-300 hover:text-white"
        >
          <Download className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <button
          onClick={() => window.print()}
          aria-label="Print"
          className="text-slate-300 hover:text-white"
        >
          <Printer className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="mx-auto my-6 w-full max-w-3xl border border-gray-300 px-8 py-10">
        <div className="mb-2 flex justify-center">
          {verificationToken ? (
            <QRCodeSVG
              value={`${window.location.origin}/verifier/${verificationToken}`}
              size={56}
            />
          ) : (
            <div className="h-14 w-14" />
          )}
        </div>
        <h1 className="text-center text-xl font-bold tracking-wide text-black">
          PAYMENT AUTHORIZATION FORM
        </h1>
        <div className="mb-8 mt-2 border-b border-gray-300" />

        <div className="mb-8 grid grid-cols-2 gap-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-black">Item No. :</span>
            <input
              type="text"
              value={numEJInput}
              onChange={(e) => setNumEJInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goToPiece(numEJInput);
              }}
              onBlur={() => goToPiece(numEJInput)}
              style={{ borderColor: "#34E0B0" }}
              className="w-32 border px-2 py-0.5 text-center font-bold text-blue-700 outline-none"
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-black">Date :</span>
            <span className="flex-1 border-b border-gray-300 text-black">
              {premiere ? new Date(premiere.date_operation).toLocaleDateString("en-GB") : ""}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-bold text-black">N°chq/ov/bcs :</span>
            <span className="flex-1 border-b border-gray-300" style={{ color: DARK_GRAY }}>
              {premiere?.n_cheque_ov}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-black">Project ID :</span>
            <span className="flex-1 border-b border-gray-300 text-black">
              {project?.code_projet}
            </span>
          </div>

          <div className="col-span-2 flex items-baseline gap-2">
            <span className="font-bold text-black">Beneficiary :</span>
            <span className="flex-1 border-b border-gray-300" style={{ color: BROWN }}>
              {premiere?.tiers}
            </span>
          </div>
          <div className="col-span-2 flex items-baseline gap-2">
            <span className="font-bold text-black">Organization :</span>
            <span className="flex-1 border-b border-gray-300" style={{ color: BROWN }}>
              {organization?.nom}
            </span>
          </div>
        </div>

        {loading && <p className="mb-4 text-sm text-black">Loading...</p>}
        {error && <p className="mb-4 text-sm text-red-600 print:hidden">{error}</p>}

        {premiere && (
          <>
            {estPieceAnterieure ? (
              <div className="mb-8 border border-red-600 px-4 py-3 text-sm font-semibold text-red-600">
                PREVIOUS PIECE — balance cannot be calculated. A more recent operation exists on
                this account ({dernierNEJCompte}). Printing unavailable for {nejRoute}.
              </div>
            ) : (
              <>
                <div className="mb-8 flex text-sm">
                  <div className="flex-1">
                    <div
                      className="border border-gray-400 py-1 text-center font-bold text-black"
                      style={{ backgroundColor: "#EEEEEE" }}
                    >
                      Section
                    </div>
                    <div className="px-1 pt-2">
                      <div className="font-bold text-black">Approved Budget :</div>
                      <div className="font-bold text-black">Currently available :</div>
                      <div className="font-bold text-black">This request :</div>
                      <div className="font-bold text-black">RESTING balance :</div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div
                      className="border border-gray-400 py-1 text-center font-bold text-black"
                      style={{ backgroundColor: "#EEEEEE" }}
                    >
                      Budget
                    </div>
                    <div className="border border-t-0 border-gray-400 px-3 py-1">
                      <div className="text-right text-black">
                        {Math.round(budgetGlobal).toLocaleString("en-US")}
                      </div>
                      <div className="text-right text-black">
                        {soldeDisponible !== null
                          ? Math.round(soldeDisponible).toLocaleString("en-US")
                          : "—"}
                      </div>
                      <div className="text-right text-black">
                        {Math.round(montantDemande).toLocaleString("en-US")}
                      </div>
                      <div className="text-right font-bold text-red-600">
                        {soldeRestant !== null
                          ? Math.round(soldeRestant).toLocaleString("en-US")
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <table className="mb-0 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-400">
                      <th className="border-r border-gray-300 py-1 text-center font-bold text-black">
                        Budget code
                      </th>
                      <th className="border-r border-gray-300 py-1 text-center font-bold text-black">
                        Account No.
                      </th>
                      <th className="border-r border-gray-300 py-1 text-center font-bold text-black">
                        Libelle
                      </th>
                      <th className="border-r border-gray-300 py-1 text-center font-bold text-black">
                        Debit
                      </th>
                      <th className="py-1 text-center font-bold text-black">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l) => (
                      <tr key={l.id}>
                        <td className="border-r border-gray-300 px-2 py-1 text-center text-black">
                          {l.b_s_line}
                        </td>
                        <td className="border-r border-gray-300 px-2 py-1 text-center text-black">
                          {l.montant_debit > 0 ? l.compte_debit : l.compte_credit}
                        </td>
                        <td className="border-r border-gray-300 px-2 py-1 text-black">
                          {l.libelle}
                        </td>
                        <td className="border-r border-gray-300 px-2 py-1 text-right text-black">
                          {l.montant_debit ? l.montant_debit.toLocaleString("en-US") : ""}
                        </td>
                        <td className="px-2 py-1 text-right text-black">
                          {l.montant_credit ? l.montant_credit.toLocaleString("en-US") : ""}
                        </td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, 6 - lignes.length) }).map((_, i) => (
                      <tr key={`blank-${i}`}>
                        <td className="border-r border-gray-300 px-2 py-3">&nbsp;</td>
                        <td className="border-r border-gray-300 px-2 py-3">&nbsp;</td>
                        <td className="border-r border-gray-300 px-2 py-3">&nbsp;</td>
                        <td className="border-r border-gray-300 px-2 py-3">&nbsp;</td>
                        <td className="px-2 py-3">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mb-10 flex justify-end gap-6 border-t border-gray-400 pt-2 text-sm font-bold">
                  <span className="text-black">TOTALS ................=</span>
                  <span className="w-24 text-right text-blue-700">
                    {lignes.reduce((s, l) => s + l.montant_debit, 0).toLocaleString("en-US")}
                  </span>
                  <span className="w-24 text-right text-blue-700">
                    {lignes.reduce((s, l) => s + l.montant_credit, 0).toLocaleString("en-US")}
                  </span>
                </div>
              </>
            )}

            <div className="relative mb-10 grid grid-cols-2 gap-8 text-sm">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold tracking-widest text-gray-100">FIMS</span>
              </div>
              <div className="relative">
                <div
                  className="flex items-center gap-1.5 border border-gray-400 px-2 py-1 font-bold text-black"
                  style={{ backgroundColor: "#EEEEEE" }}
                >
                  <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
                  Checked by : Administrative &amp; Financial Manager
                </div>
                <div className="flex h-24 flex-col justify-between border border-t-0 border-gray-400 px-2 py-1">
                  <p className="text-black">{project?.administrative_financial_manager}</p>
                  <p className="font-bold text-black">Date :</p>
                </div>
                <p className="mt-1 text-xs text-black">
                  By signing, you certify that the entries made are correct.
                </p>
              </div>
              <div className="relative">
                <div
                  className="flex items-center gap-1.5 border border-gray-400 px-2 py-1 font-bold text-black"
                  style={{ backgroundColor: "#EEEEEE" }}
                >
                  <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  Approved by : Program Coordinator/President
                </div>
                <div className="flex h-24 flex-col justify-between border border-t-0 border-gray-400 px-2 py-1">
                  <p className="text-black">{project?.program_coordinator_president}</p>
                  <p className="font-bold text-black">Date :</p>
                </div>
                <p className="mt-1 text-xs text-black">
                  By signing, you authorise the expenditure for the project.
                </p>
              </div>
            </div>

            <p className="text-center text-xs">
              <span className="font-bold text-black">Seized by : </span>
              <span className="border-b border-gray-300" style={{ color: BROWN }}>
                {premiere.utilisateur}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
