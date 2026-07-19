"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { periodeCouranteFermee } from "@/lib/period-closure";
import type { ChartOfAccount, ThirdParty, Zone } from "@/lib/types";

const JOURNAUX = ["AC", "BQ", "OD", "SA"];
const TYPES_OPERATION = [
  "AVANCE et REGU",
  "PRISE EN CHARGE",
  "REGLEMENT",
  "REVERSEMENT",
  "TRESORERIE",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function nextSequence(
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

export default function SaisiePage() {
  const { profile, project } = useAuth();

  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  const [dateOperation, setDateOperation] = useState(todayIso());
  const [journal, setJournal] = useState("BQ");
  const [typeOperation, setTypeOperation] = useState(TYPES_OPERATION[0]);
  const [compteDebit, setCompteDebit] = useState("");
  const [compteCredit, setCompteCredit] = useState("");
  const [montant, setMontant] = useState("");
  const [tiers, setTiers] = useState("");
  const [libelle, setLibelle] = useState("");
  const [nPiece, setNPiece] = useState("");
  const [bSLine, setBSLine] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [refFactD, setRefFactD] = useState("");
  const [nChequeOv, setNChequeOv] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;

    supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("project_id", project.id)
      .order("compte")
      .then(({ data }) => setAccounts((data as ChartOfAccount[]) ?? []));

    supabase
      .from("third_parties")
      .select("*")
      .eq("project_id", project.id)
      .then(({ data }) => setThirdParties((data as ThirdParty[]) ?? []));

    supabase
      .from("zones")
      .select("*")
      .eq("organization_id", project.organization_id)
      .order("code")
      .then(({ data }) => setZones((data as Zone[]) ?? []));

    nextSequence(project.id, "n_piece", "PC").then(setNPiece);
  }, [project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const montantNum = parseFloat(montant);

    if (!compteDebit || !compteCredit) {
      setError("Le compte débit et le compte crédit sont obligatoires.");
      return;
    }
    if (compteDebit === compteCredit) {
      setError("Le compte débit et le compte crédit doivent être différents.");
      return;
    }
    if (!montantNum || montantNum <= 0) {
      setError("Le montant doit être supérieur à zéro.");
      return;
    }
    if (!libelle.trim()) {
      setError("Le libellé est obligatoire.");
      return;
    }
    if (!project || !profile) {
      setError("Projet ou profil introuvable.");
      return;
    }

    const blocageCloture = await periodeCouranteFermee(project.id);
    if (blocageCloture) {
      setError(blocageCloture);
      return;
    }

    setSubmitting(true);

    const nEcritureJournal = await nextSequence(
      project.id,
      "n_ecriture_journal",
      journal
    );

    const common = {
      organization_id: profile.organization_id,
      project_id: project.id,
      date_operation: dateOperation,
      type_operation: typeOperation,
      journal,
      n_ecriture_journal: nEcritureJournal,
      n_piece: nPiece || null,
      tiers: tiers || null,
      libelle,
      b_s_line: bSLine || null,
      zone_id: zoneId ? parseInt(zoneId, 10) : null,
      ref_fact_d: refFactD || null,
      n_cheque_ov: nChequeOv || null,
      date_heure_saisie: new Date().toISOString(),
      utilisateur: profile.nom_utilisateur,
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase.from("journal_entries").insert([
      {
        ...common,
        compte_debit: compteDebit,
        compte_credit: null,
        montant_debit: montantNum,
        montant_credit: 0,
      },
      {
        ...common,
        compte_debit: null,
        compte_credit: compteCredit,
        montant_debit: 0,
        montant_credit: montantNum,
      },
    ]);

    setSubmitting(false);

    if (insertError) {
      setError(`Erreur d'enregistrement : ${insertError.message}`);
      return;
    }

    setSuccess(`Écriture ${nEcritureJournal} enregistrée (2 lignes équilibrées).`);
    setMontant("");
    setLibelle("");
    setCompteDebit("");
    setCompteCredit("");
    setTiers("");
    setBSLine("");
    setZoneId("");
    setRefFactD("");
    setNChequeOv("");
    nextSequence(project.id, "n_piece", "PC").then(setNPiece);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-100">
          Saisie d&apos;écriture
        </h1>
        <div className="flex gap-4">
          <Link href="/lettrage" className="text-sm text-sky-400 hover:underline">
            Lettrage / Délettrage →
          </Link>
          <Link href="/cloture" className="text-sm text-sky-400 hover:underline">
            Clôture de période →
          </Link>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl rounded-xl border border-slate-700 bg-slate-900/60 p-6"
      >
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-300">
              Date de la pièce *
            </label>
            <input
              type="date"
              required
              value={dateOperation}
              onChange={(e) => setDateOperation(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">
              N° Pièce
            </label>
            <input
              type="text"
              value={nPiece}
              onChange={(e) => setNPiece(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">
              Journal *
            </label>
            <select
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            >
              {JOURNAUX.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">
              Type d&apos;opération *
            </label>
            <select
              value={typeOperation}
              onChange={(e) => setTypeOperation(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            >
              {TYPES_OPERATION.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">
              Compte débit *
            </label>
            <input
              list="comptes-list"
              required
              value={compteDebit}
              onChange={(e) => setCompteDebit(e.target.value)}
              placeholder="Rechercher un compte..."
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">
              Compte crédit *
            </label>
            <input
              list="comptes-list"
              required
              value={compteCredit}
              onChange={(e) => setCompteCredit(e.target.value)}
              placeholder="Rechercher un compte..."
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>

          <datalist id="comptes-list">
            {accounts.map((a) => (
              <option key={a.id} value={a.ccompte}>
                {a.libelle}
              </option>
            ))}
          </datalist>

          <div>
            <label className="mb-1 block text-sm text-slate-300">
              Montant *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Tiers</label>
            <input
              list="tiers-list"
              value={tiers}
              onChange={(e) => setTiers(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
            <datalist id="tiers-list">
              {thirdParties.map((t) => (
                <option key={t.id} value={t.nom_tiers} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Zone</label>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            >
              <option value="">—</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">
              B-S-Line
            </label>
            <input
              type="text"
              value={bSLine}
              onChange={(e) => setBSLine(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">
              Réf. Facture/Devis
            </label>
            <input
              type="text"
              value={refFactD}
              onChange={(e) => setRefFactD(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">
              N° Chèque/OV
            </label>
            <input
              type="text"
              value={nChequeOv}
              onChange={(e) => setNChequeOv(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-slate-300">
              Libellé *
            </label>
            <input
              type="text"
              required
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        {success && (
          <p className="mb-4 text-sm text-emerald-400">{success}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-emerald-500 px-6 py-2 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {submitting ? "Enregistrement..." : "Valider"}
        </button>
      </form>
    </div>
  );
}
