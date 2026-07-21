"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { FormField } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { JournalEntry } from "@/lib/types";

// Reproduit LettrageAutomatique_JDEPENSE() du FIMS original (VBA) :
// pour chaque pièce, apparie deux écritures non lettrées portant sur
// le même compte dont (crédit - débit) s'annule à 0.01 près, et leur
// attribue un même code LTR-XXX.
function calculerLettrage(entries: JournalEntry[]): {
  updates: JournalEntry[];
  nbPaires: number;
} {
  const byPiece = new Map<string, JournalEntry[]>();
  entries.forEach((e) => {
    if (e.n_lettrage) return;
    const key = e.n_piece ?? `__id_${e.id}`;
    const list = byPiece.get(key) ?? [];
    list.push(e);
    byPiece.set(key, list);
  });

  const updates: JournalEntry[] = [];
  let compteur = 1;

  byPiece.forEach((group) => {
    const used = new Set<number>();
    for (let i = 0; i < group.length; i++) {
      if (used.has(group[i].id)) continue;
      const compteI = group[i].compte_debit || group[i].compte_credit;
      const montantI = group[i].montant_credit - group[i].montant_debit;

      for (let j = i + 1; j < group.length; j++) {
        if (used.has(group[j].id)) continue;
        const compteJ = group[j].compte_debit || group[j].compte_credit;
        const montantJ = group[j].montant_credit - group[j].montant_debit;

        if (compteI && compteI === compteJ && Math.abs(montantI + montantJ) <= 0.01) {
          const code = `LTR-${String(compteur).padStart(3, "0")}`;
          compteur++;
          updates.push({ ...group[i], n_lettrage: code });
          updates.push({ ...group[j], n_lettrage: code });
          used.add(group[i].id);
          used.add(group[j].id);
          break;
        }
      }
    }
  });

  return { updates, nbPaires: updates.length / 2 };
}

export default function LettragePage() {
  const { project } = useAuth();
  const { t } = useLanguage();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [compte, setCompte] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadEntries() {
    if (!project) return;
    setLoading(true);
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("project_id", project.id)
      .order("n_piece");
    setEntries((data as JournalEntry[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  async function runLettrage() {
    setRunning(true);
    setMessage(null);
    const { updates, nbPaires } = calculerLettrage(entries);

    if (updates.length === 0) {
      setRunning(false);
      setMessage(t.lettrage.aucuneNouvelleCorrespondance);
      return;
    }

    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from("journal_entries")
          .update({ n_lettrage: u.n_lettrage })
          .eq("id", u.id)
      )
    );

    setRunning(false);

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setMessage(`Erreur : ${failed.error.message}`);
      return;
    }

    setMessage(`${t.lettrage.lettrageTermine} ${nbPaires} ${t.lettrage.pairesRapprochees}`);
    loadEntries();
  }

  async function runDelettrage() {
    if (!project) return;
    if (!window.confirm(t.lettrage.confirmDelettrer)) {
      return;
    }
    setRunning(true);
    setMessage(null);

    const { error } = await supabase
      .from("journal_entries")
      .update({ n_lettrage: null })
      .eq("project_id", project.id);

    setRunning(false);

    if (error) {
      setMessage(`Erreur : ${error.message}`);
      return;
    }

    setMessage(t.lettrage.tousLettragesSupprimes);
    loadEntries();
  }

  const filtered = entries.filter((e) => {
    if (!compte.trim()) return true;
    const c = compte.toLowerCase();
    return (
      (e.compte_debit ?? "").toLowerCase().includes(c) ||
      (e.compte_credit ?? "").toLowerCase().includes(c)
    );
  });

  const nbLettrees = entries.filter((e) => e.n_lettrage).length;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">{t.lettrage.titre}</h1>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-bg-card p-4">
        <PrimaryButton onClick={runLettrage} disabled={running || loading}>
          {running ? "..." : t.lettrage.lancerLettrage}
        </PrimaryButton>
        <button
          onClick={runDelettrage}
          disabled={running || loading}
          className="rounded-md border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:bg-bg-card disabled:opacity-60"
        >
          {t.lettrage.toutDelettrer}
        </button>
        <span className="text-sm text-text-secondary">
          {nbLettrees} / {entries.length} {t.lettrage.ecrituresLettrees}
        </span>
      </div>

      {message && (
        <p className="mb-4 rounded-md bg-bg-card px-4 py-2 text-sm text-accent-teal">
          {message}
        </p>
      )}

      <div className="mb-4 max-w-sm">
        <FormField
          label={t.lettrage.filtrerParCompte}
          value={compte}
          onChange={(e) => setCompte(e.target.value)}
          placeholder={t.lettrage.filtrerPlaceholder}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-full text-sm">
          <MiniTableHeader
            columns={[t.lettrage.colPiece, t.lettrage.colDate, t.lettrage.colCompte, t.lettrage.colLibelle, t.lettrage.colDebit, t.lettrage.colCredit, t.lettrage.colLettrage]}
            align={["left", "left", "left", "left", "right", "right", "left"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-text-secondary">
                  {t.common.chargement}
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((e) => (
                <tr key={e.id} className="text-text-primary">
                  <td className="px-3 py-2">{e.n_piece}</td>
                  <td className="px-3 py-2">
                    {new Date(e.date_operation).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-3 py-2">
                    {e.compte_debit ?? e.compte_credit}
                  </td>
                  <td className="px-3 py-2">{e.libelle}</td>
                  <td className="px-3 py-2 text-right">
                    {e.montant_debit ? e.montant_debit.toLocaleString("fr-FR") : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {e.montant_credit ? e.montant_credit.toLocaleString("fr-FR") : ""}
                  </td>
                  <td className="px-3 py-2">
                    {e.n_lettrage ? (
                      <span className="rounded-full bg-bg-card-teal px-2 py-0.5 text-xs text-accent-teal">
                        {e.n_lettrage}
                      </span>
                    ) : (
                      <span className="text-xs text-text-secondary">—</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
