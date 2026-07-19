"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { JournalEntry, ThirdParty } from "@/lib/types";

function firstOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function JournalAuxiliairePage() {
  const { project } = useAuth();
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [tiers, setTiers] = useState("");
  const [dateDebut, setDateDebut] = useState(firstOfMonthIso());
  const [dateFin, setDateFin] = useState(todayIso());
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!project) return;
    supabase
      .from("third_parties")
      .select("*")
      .eq("project_id", project.id)
      .order("nom_tiers")
      .then(({ data }) => setThirdParties((data as ThirdParty[]) ?? []));
  }, [project]);

  useEffect(() => {
    if (!project || !tiers) {
      setEntries([]);
      return;
    }
    setLoading(true);

    supabase
      .from("journal_entries")
      .select("*")
      .eq("project_id", project.id)
      .eq("tiers", tiers)
      .gte("date_operation", dateDebut)
      .lte("date_operation", dateFin)
      .order("date_operation", { ascending: true })
      .then(({ data }) => {
        setEntries((data as JournalEntry[]) ?? []);
        setLoading(false);
      });
  }, [project, tiers, dateDebut, dateFin]);

  let running = 0;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-100">
        Journal Auxiliaire
      </h1>

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Tiers</label>
          <select
            value={tiers}
            onChange={(e) => setTiers(e.target.value)}
            className="min-w-[220px] rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
          >
            <option value="">Sélectionner un tiers...</option>
            {thirdParties.map((t) => (
              <option key={t.id} value={t.nom_tiers}>
                {t.nom_tiers}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Du</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Au</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Pièce</th>
              <th className="px-3 py-2 text-left">Libellé</th>
              <th className="px-3 py-2 text-right">Débit</th>
              <th className="px-3 py-2 text-right">Crédit</th>
              <th className="px-3 py-2 text-right">Solde cumulé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/40">
            {!tiers && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                  Sélectionnez un tiers pour afficher son journal.
                </td>
              </tr>
            )}
            {tiers && loading && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                  Chargement...
                </td>
              </tr>
            )}
            {tiers && !loading && entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                  Aucune écriture sur cette période.
                </td>
              </tr>
            )}
            {entries.map((e) => {
              running += e.montant_debit - e.montant_credit;
              return (
                <tr key={e.id} className="text-slate-200">
                  <td className="px-3 py-2">
                    {new Date(e.date_operation).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-3 py-2">{e.n_piece}</td>
                  <td className="px-3 py-2">{e.libelle}</td>
                  <td className="px-3 py-2 text-right">
                    {e.montant_debit ? e.montant_debit.toLocaleString("fr-FR") : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {e.montant_credit ? e.montant_credit.toLocaleString("fr-FR") : ""}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {running.toLocaleString("fr-FR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
