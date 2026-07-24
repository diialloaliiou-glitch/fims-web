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
const BLUE = "#1F4FA8";
const GREEN_ITEM = "#2E9E7A";
const BROWN = "#8A6D3B";
const GRAY_NCHQ = "#4A4A4A";
const RED = "#C0392B";
const BAND_BG = "#F4F5F7";
const BORDER_PALE = "#EEEEEE";
const GRAY_TEXT = "#8A8A8A";
const FONT_DOC = 'Calibri, Carlito, "Segoe UI", sans-serif';

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

      <div
        className="mx-auto my-6 w-full max-w-[760px] rounded-[4px] px-8 py-10 shadow-[0_1px_6px_rgba(0,0,0,0.12)] print:shadow-none"
        style={{ border: `1px solid ${BORDER_PALE}`, fontFamily: FONT_DOC, fontSize: 13 }}
      >
        <div className="mb-2 flex justify-center">
          {verificationToken ? (
            <div className="opacity-40">
              <QRCodeSVG
                value={`${window.location.origin}/verifier/${verificationToken}`}
                size={48}
              />
            </div>
          ) : (
            <div className="h-12 w-12" />
          )}
        </div>
        <h1 className="text-center text-2xl font-bold tracking-wide text-black">
          PAYMENT AUTHORIZATION FORM
        </h1>
        <div className="mb-6 mt-2" style={{ borderBottom: `1px solid ${BORDER_PALE}` }} />

        <div className="mb-6 grid grid-cols-2 gap-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-bold" style={{ color: BLUE }}>
              Item No. :
            </span>
            <input
              type="text"
              value={numEJInput}
              onChange={(e) => setNumEJInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goToPiece(numEJInput);
              }}
              onBlur={() => goToPiece(numEJInput)}
              style={{ border: `1.5px solid ${GREEN_ITEM}`, color: BLUE }}
              className="w-32 px-2 py-0.5 text-center font-bold outline-none"
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-black">Date :</span>
            <span className="flex-1 text-black" style={{ borderBottom: `1px solid ${BORDER_PALE}` }}>
              {premiere ? new Date(premiere.date_operation).toLocaleDateString("en-GB") : ""}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-bold text-black">N°chq/ov/bcs :</span>
            <span
              className="flex-1"
              style={{ borderBottom: `1px solid ${BORDER_PALE}`, color: GRAY_NCHQ }}
            >
              {premiere?.n_cheque_ov}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-black">Project ID :</span>
            <span className="flex-1 text-black" style={{ borderBottom: `1px solid ${BORDER_PALE}` }}>
              {project?.code_projet}
            </span>
          </div>

          <div className="col-span-2 flex items-baseline gap-2">
            <span className="font-bold text-black">Beneficiary :</span>
            <span className="flex-1" style={{ borderBottom: `1px solid ${BORDER_PALE}`, color: BROWN }}>
              {premiere?.tiers}
            </span>
          </div>
          <div className="col-span-2 flex items-baseline gap-2">
            <span className="font-bold text-black">Organization :</span>
            <span className="flex-1" style={{ borderBottom: `1px solid ${BORDER_PALE}`, color: BROWN }}>
              {organization?.nom}
            </span>
          </div>
        </div>

        {loading && <p className="mb-4 text-black">Loading...</p>}
        {error && (
          <p className="mb-4 text-red-600 print:hidden">{error}</p>
        )}

        {premiere && (
          <>
            {estPieceAnterieure ? (
              <div className="mb-6 border border-red-600 px-4 py-3 font-semibold text-red-600">
                PREVIOUS PIECE — balance cannot be calculated. A more recent operation exists on
                this account ({dernierNEJCompte}). Printing unavailable for {nejRoute}.
              </div>
            ) : (
              <>
                <div className="mb-6 flex">
                  <div className="flex-1">
                    <div
                      className="py-1 text-center font-bold text-black"
                      style={{ border: `1px solid ${BORDER_PALE}`, backgroundColor: BAND_BG }}
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
                      className="py-1 text-center font-bold text-black"
                      style={{ border: `1px solid ${BORDER_PALE}`, backgroundColor: BAND_BG }}
                    >
                      Budget
                    </div>
                    <div
                      className="px-3 py-1"
                      style={{ borderLeft: `1px solid ${BORDER_PALE}`, borderRight: `1px solid ${BORDER_PALE}`, borderBottom: `1px solid ${BORDER_PALE}` }}
                    >
                      <div className="text-right text-black">
                        {Math.round(budgetGlobal).toLocaleString("fr-FR")}
                      </div>
                      <div className="text-right text-black">
                        {soldeDisponible !== null
                          ? Math.round(soldeDisponible).toLocaleString("fr-FR")
                          : "—"}
                      </div>
                      <div className="text-right text-black">
                        {Math.round(montantDemande).toLocaleString("fr-FR")}
                      </div>
                      <div className="text-right font-bold" style={{ color: RED }}>
                        {soldeRestant !== null
                          ? Math.round(soldeRestant).toLocaleString("fr-FR")
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <table className="w-full border-collapse">
                  <thead>
                    <tr
                      style={{
                        borderTop: `1px solid ${BORDER_PALE}`,
                        borderBottom: `1px solid ${BORDER_PALE}`,
                      }}
                    >
                      <th className="py-1 text-center font-bold text-black">Budget code</th>
                      <th className="py-1 text-center font-bold text-black">Account No.</th>
                      <th className="py-1 text-center font-bold text-black">Libelle</th>
                      <th className="py-1 text-center font-bold text-black">Debit</th>
                      <th className="py-1 text-center font-bold text-black">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l) => (
                      <tr key={l.id}>
                        <td className="px-2 py-1 text-center text-black">{l.b_s_line}</td>
                        <td className="px-2 py-1 text-center text-black">
                          {l.montant_debit > 0 ? l.compte_debit : l.compte_credit}
                        </td>
                        <td className="px-2 py-1 text-black">{l.libelle}</td>
                        <td className="px-2 py-1 text-right text-black">
                          {l.montant_debit ? l.montant_debit.toLocaleString("fr-FR") : ""}
                        </td>
                        <td className="px-2 py-1 text-right text-black">
                          {l.montant_credit ? l.montant_credit.toLocaleString("fr-FR") : ""}
                        </td>
                      </tr>
                    ))}
                    {/* Espace vide volontaire pour l'ajout manuel de lignes a
                        l'impression - ne pas reduire. */}
                    <tr>
                      <td colSpan={5} style={{ height: 190 }} />
                    </tr>
                  </tbody>
                </table>

                <div
                  className="mb-[130px] flex justify-end gap-6 pt-2 font-bold"
                  style={{ borderTop: `1px solid ${BORDER_PALE}` }}
                >
                  <span className="text-black">TOTALS ................=</span>
                  <span className="w-24 text-right" style={{ color: BLUE }}>
                    {lignes.reduce((s, l) => s + l.montant_debit, 0).toLocaleString("fr-FR")}
                  </span>
                  <span className="w-24 text-right" style={{ color: BLUE }}>
                    {lignes.reduce((s, l) => s + l.montant_credit, 0).toLocaleString("fr-FR")}
                  </span>
                </div>
              </>
            )}

            <div style={{ border: `1px solid ${BORDER_PALE}` }} className="px-2 pb-4 pt-3">
              <div className="relative grid grid-cols-2 gap-[200px]">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold tracking-widest text-gray-100">FIMS</span>
                </div>
                <div className="relative">
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 font-bold text-black"
                    style={{ border: `1px solid ${BORDER_PALE}`, backgroundColor: BAND_BG }}
                  >
                    <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
                    Checked by : Administrative &amp; Financial Manager
                  </div>
                  <div
                    className="flex flex-col px-2 py-1"
                    style={{ borderLeft: `1px solid ${BORDER_PALE}`, borderRight: `1px solid ${BORDER_PALE}`, borderBottom: `1px solid ${BORDER_PALE}` }}
                  >
                    <p className="text-black">{project?.administrative_financial_manager}</p>
                    <div style={{ height: 80 }} />
                    <p style={{ color: GRAY_TEXT }}>Date :</p>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: GRAY_TEXT }}>
                    By signing, you certify that the entries made are correct.
                  </p>
                </div>
                <div className="relative">
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 font-bold text-black"
                    style={{ border: `1px solid ${BORDER_PALE}`, backgroundColor: BAND_BG }}
                  >
                    <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} />
                    Approved by : Program Coordinator/President
                  </div>
                  <div
                    className="flex flex-col px-2 py-1"
                    style={{ borderLeft: `1px solid ${BORDER_PALE}`, borderRight: `1px solid ${BORDER_PALE}`, borderBottom: `1px solid ${BORDER_PALE}` }}
                  >
                    <p className="text-black">{project?.program_coordinator_president}</p>
                    <div style={{ height: 80 }} />
                    <p style={{ color: GRAY_TEXT }}>Date :</p>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: GRAY_TEXT }}>
                    By signing, you authorise the expenditure for the project.
                  </p>
                </div>
              </div>

              <p className="mt-4 text-center text-xs">
                <span className="font-bold text-black">Seized by : </span>
                <span style={{ borderBottom: `1px solid ${BORDER_PALE}`, color: BROWN }}>
                  {premiere.utilisateur}
                </span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
