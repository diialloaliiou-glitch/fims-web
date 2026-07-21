"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Home, Download, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PREFIXE_COMPTE_BANQUE_PROJET } from "@/lib/solde-banque";
import { getOrCreateVerificationToken } from "@/lib/verification-piece";
import type { BudgetLine, JournalEntry } from "@/lib/types";

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

      <div className="mx-auto w-full max-w-3xl px-8 py-10">
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
        <h1 className="mb-8 text-center text-xl font-semibold tracking-wide">
          PAYMENT AUTHORIZATION FORM
        </h1>

        <div className="mb-8 grid grid-cols-2 gap-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-blue-700">Item No. :</span>
            <input
              type="text"
              value={numEJInput}
              onChange={(e) => setNumEJInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goToPiece(numEJInput);
              }}
              onBlur={() => goToPiece(numEJInput)}
              className="w-32 border border-emerald-600 px-2 py-0.5 text-center font-bold text-blue-700 outline-none"
            />
          </div>
          <div>
            <span className="text-gray-600">Date : </span>
            {premiere ? new Date(premiere.date_operation).toLocaleDateString("en-GB") : ""}
          </div>

          <div>
            <span className="text-gray-600">N°chq/ov/bcs : </span>
            {premiere?.n_cheque_ov}
          </div>
          <div>
            <span className="text-gray-600">Project ID : </span>
            {project?.code_projet}
          </div>

          <div className="col-span-2">
            <span className="text-gray-600">Beneficiary : </span>
            {premiere?.tiers}
          </div>
          <div className="col-span-2">
            <span className="text-gray-600">Organization : </span>
            {organization?.nom}
          </div>
        </div>

        {loading && <p className="mb-4 text-sm text-gray-500">Loading...</p>}
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
                <table className="mb-8 w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="w-1/2 border border-black bg-gray-100 py-1 text-center font-semibold">
                        Section
                      </td>
                      <td className="w-1/2 border border-black bg-gray-100 py-1 text-center font-semibold">
                        Budget
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black px-3 py-1">Approved Budget :</td>
                      <td className="border border-black px-3 py-1 text-right">
                        {Math.round(budgetGlobal).toLocaleString("en-US")}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black px-3 py-1">Currently available :</td>
                      <td className="border border-black px-3 py-1 text-right">
                        {soldeDisponible !== null
                          ? Math.round(soldeDisponible).toLocaleString("en-US")
                          : "—"}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black px-3 py-1">This request :</td>
                      <td className="border border-black px-3 py-1 text-right">
                        {Math.round(montantDemande).toLocaleString("en-US")}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black px-3 py-1">RESTING balance :</td>
                      <td className="border border-black px-3 py-1 text-right font-semibold text-red-600">
                        {soldeRestant !== null
                          ? Math.round(soldeRestant).toLocaleString("en-US")
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="mb-2 w-full text-sm">
                  <thead>
                    <tr>
                      <th className="border border-black bg-gray-100 py-1 font-semibold">
                        Budget code
                      </th>
                      <th className="border border-black bg-gray-100 py-1 font-semibold">
                        Account No.
                      </th>
                      <th className="border border-black bg-gray-100 py-1 font-semibold">
                        Libelle
                      </th>
                      <th className="border border-black bg-gray-100 py-1 font-semibold">
                        Debit
                      </th>
                      <th className="border border-black bg-gray-100 py-1 font-semibold">
                        Credit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l) => (
                      <tr key={l.id}>
                        <td className="border border-black px-2 py-1 text-center">
                          {l.b_s_line}
                        </td>
                        <td className="border border-black px-2 py-1 text-center">
                          {l.montant_debit > 0 ? l.compte_debit : l.compte_credit}
                        </td>
                        <td className="border border-black px-2 py-1">{l.libelle}</td>
                        <td className="border border-black px-2 py-1 text-right">
                          {l.montant_debit ? l.montant_debit.toLocaleString("en-US") : ""}
                        </td>
                        <td className="border border-black px-2 py-1 text-right">
                          {l.montant_credit ? l.montant_credit.toLocaleString("en-US") : ""}
                        </td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, 6 - lignes.length) }).map((_, i) => (
                      <tr key={`blank-${i}`}>
                        <td className="border border-black px-2 py-3">&nbsp;</td>
                        <td className="border border-black px-2 py-3">&nbsp;</td>
                        <td className="border border-black px-2 py-3">&nbsp;</td>
                        <td className="border border-black px-2 py-3">&nbsp;</td>
                        <td className="border border-black px-2 py-3">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mb-10 flex justify-end gap-6 text-sm font-semibold">
                  <span>TOTALS ................=</span>
                  <span className="w-24 text-right">
                    {lignes.reduce((s, l) => s + l.montant_debit, 0).toLocaleString("en-US")}
                  </span>
                  <span className="w-24 text-right">
                    {lignes.reduce((s, l) => s + l.montant_credit, 0).toLocaleString("en-US")}
                  </span>
                </div>
              </>
            )}

            <div className="mb-10 grid grid-cols-2 gap-8 text-sm">
              <div>
                <p className="mb-1 border-b border-black pb-1 font-semibold">
                  Prepared by : Administrative &amp; Financial Manager
                </p>
                <p className="mb-6 mt-2">{project?.administrative_financial_manager}</p>
                <p className="text-xs text-gray-600">Date :</p>
                <p className="mt-1 text-xs text-gray-600">
                  By signing, you certify that the entries made are correct.
                </p>
              </div>
              <div>
                <p className="mb-1 border-b border-black pb-1 font-semibold">
                  Approved by : Program Coordinator/President
                </p>
                <p className="mb-6 mt-2">{project?.program_coordinator_president}</p>
                <p className="text-xs text-gray-600">Date :</p>
                <p className="mt-1 text-xs text-gray-600">
                  By signing, you authorise the expenditure for the project.
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600">Seized by : {premiere.utilisateur}</p>
          </>
        )}
      </div>
    </div>
  );
}
