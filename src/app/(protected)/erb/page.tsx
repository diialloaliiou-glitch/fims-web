"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { ErbLine } from "@/lib/types";

type Cote = "CHEZ_MOI" | "CHEZ_BANQUE";

const emptyForm = {
  date_operation: new Date().toISOString().slice(0, 10),
  reference: "",
  operation: "",
  montant: "",
  sens: "debit" as "debit" | "credit",
};

function Colonne({
  titre,
  cote,
  lines,
  onAdded,
  showPointe,
}: {
  titre: string;
  cote: Cote;
  lines: ErbLine[];
  onAdded: () => void;
  showPointe: boolean;
}) {
  const { profile, project } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...lines].sort((a, b) =>
    (a.date_operation ?? "").localeCompare(b.date_operation ?? "")
  );

  let solde = 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const montantNum = parseFloat(form.montant);
    if (!form.operation.trim()) {
      setError("L'opération est obligatoire.");
      return;
    }
    if (!montantNum || montantNum <= 0) {
      setError("Le montant doit être supérieur à zéro.");
      return;
    }
    if (!project || !profile) return;

    setSaving(true);

    const { error: insertError } = await supabase.from("erb_lines").insert({
      organization_id: profile.organization_id,
      project_id: project.id,
      cote,
      date_operation: form.date_operation || null,
      reference: form.reference.trim() || null,
      operation: form.operation.trim(),
      montant_debit: form.sens === "debit" ? montantNum : 0,
      montant_credit: form.sens === "credit" ? montantNum : 0,
      pointe: false,
    });

    setSaving(false);

    if (insertError) {
      setError(`Erreur : ${insertError.message}`);
      return;
    }

    setForm({ ...emptyForm, date_operation: form.date_operation });
    onAdded();
  }

  async function togglePointe(l: ErbLine) {
    await supabase.from("erb_lines").update({ pointe: !l.pointe }).eq("id", l.id);
    onAdded();
  }

  return (
    <div>
      <p className="mb-3 font-semibold text-text-primary">{titre}</p>

      <form
        onSubmit={handleSubmit}
        className="mb-4 rounded-xl border border-border-subtle bg-bg-card p-4"
      >
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-text-secondary">Date</label>
            <input
              type="date"
              value={form.date_operation}
              onChange={(e) =>
                setForm({ ...form, date_operation: e.target.value })
              }
              className="w-full rounded-md border border-border-subtle bg-bg-card px-2 py-1.5 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">
              Référence
            </label>
            <input
              type="text"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="w-full rounded-md border border-border-subtle bg-bg-card px-2 py-1.5 text-sm text-text-primary"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-text-secondary">
              Opération *
            </label>
            <input
              type="text"
              value={form.operation}
              onChange={(e) => setForm({ ...form, operation: e.target.value })}
              className="w-full rounded-md border border-border-subtle bg-bg-card px-2 py-1.5 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">
              Montant *
            </label>
            <input
              type="number"
              step="0.01"
              value={form.montant}
              onChange={(e) => setForm({ ...form, montant: e.target.value })}
              className="w-full rounded-md border border-border-subtle bg-bg-card px-2 py-1.5 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">Sens</label>
            <select
              value={form.sens}
              onChange={(e) =>
                setForm({ ...form, sens: e.target.value as "debit" | "credit" })
              }
              className="w-full rounded-md border border-border-subtle bg-bg-card px-2 py-1.5 text-sm text-text-primary"
            >
              <option value="debit">Débit</option>
              <option value="credit">Crédit</option>
            </select>
          </div>
        </div>
        {error && <p className="mb-2 text-xs text-accent-red">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent-teal px-4 py-1.5 text-sm font-medium text-on-accent-light hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "..." : "+ Ajouter"}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-full text-sm">
          <thead className="bg-bg-card text-text-secondary">
            <tr>
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Référence</th>
              <th className="px-2 py-2 text-left">Opération</th>
              <th className="px-2 py-2 text-right">Débit</th>
              <th className="px-2 py-2 text-right">Crédit</th>
              {showPointe && <th className="px-2 py-2 text-center">C</th>}
              <th className="px-2 py-2 text-right">Solde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={showPointe ? 7 : 6}
                  className="px-2 py-3 text-center text-text-secondary"
                >
                  Aucune ligne.
                </td>
              </tr>
            )}
            {sorted.map((l) => {
              solde += l.montant_debit - l.montant_credit;
              return (
                <tr key={l.id} className="text-text-primary">
                  <td className="px-2 py-1.5">
                    {l.date_operation
                      ? new Date(l.date_operation).toLocaleDateString("fr-FR")
                      : ""}
                  </td>
                  <td className="px-2 py-1.5">{l.reference}</td>
                  <td className="px-2 py-1.5">{l.operation}</td>
                  <td className="px-2 py-1.5 text-right">
                    {l.montant_debit ? l.montant_debit.toLocaleString("fr-FR") : ""}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {l.montant_credit
                      ? l.montant_credit.toLocaleString("fr-FR")
                      : ""}
                  </td>
                  {showPointe && (
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={l.pointe}
                        onChange={() => togglePointe(l)}
                      />
                    </td>
                  )}
                  <td className="px-2 py-1.5 text-right font-medium">
                    {solde.toLocaleString("fr-FR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {sorted.length > 0 && (
            <tfoot className="bg-bg-card font-semibold text-text-primary">
              <tr>
                <td className="px-2 py-1.5" colSpan={showPointe ? 5 : 4}>
                  SOLDE
                </td>
                <td className="px-2 py-1.5 text-right" colSpan={showPointe ? 2 : 2}>
                  {solde.toLocaleString("fr-FR")}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default function ErbPage() {
  const { project } = useAuth();
  const [lines, setLines] = useState<ErbLine[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadLines() {
    if (!project) return;
    setLoading(true);
    const { data } = await supabase
      .from("erb_lines")
      .select("*")
      .eq("project_id", project.id)
      .order("date_operation");
    setLines((data as ErbLine[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const chezMoi = lines.filter((l) => l.cote === "CHEZ_MOI");
  const chezBanque = lines.filter((l) => l.cote === "CHEZ_BANQUE");

  const soldeMoi = chezMoi.reduce((s, l) => s + l.montant_debit - l.montant_credit, 0);
  const soldeBanque = chezBanque.reduce(
    (s, l) => s + l.montant_debit - l.montant_credit,
    0
  );
  const ecart = soldeMoi - soldeBanque;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-text-primary">
        État de Rapprochement Bancaire (ERB)
      </h1>
      <p className="mb-6 text-sm text-text-secondary">
        Saisie manuelle des deux côtés — les lignes "CHEZ MOI" (tes livres) ne
        sont pas générées automatiquement depuis le journal, comme dans le
        classeur d&apos;origine.
      </p>

      <div
        className={`mb-6 rounded-xl border p-4 text-sm ${
          ecart === 0
            ? "border-accent-teal bg-bg-card-teal text-accent-teal"
            : "border-accent-amber bg-accent-amber/10 text-accent-amber"
        }`}
      >
        Écart entre les deux soldes :{" "}
        <span className="font-bold">{ecart.toLocaleString("fr-FR")}</span>
        {ecart === 0 ? " — rapprochement équilibré." : " — à investiguer."}
      </div>

      {loading ? (
        <p className="text-text-secondary">Chargement...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Colonne
            titre="CHEZ MOI"
            cote="CHEZ_MOI"
            lines={chezMoi}
            onAdded={loadLines}
            showPointe
          />
          <Colonne
            titre="CHEZ LA BANQUE"
            cote="CHEZ_BANQUE"
            lines={chezBanque}
            onAdded={loadLines}
            showPointe={false}
          />
        </div>
      )}
    </div>
  );
}
