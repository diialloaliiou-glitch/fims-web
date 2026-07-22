"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { NavigationSecondaire } from "@/components/ui/NavigationSecondaire";
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
  const { t } = useLanguage();
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
      setError(t.erb.erreurOperationObligatoire);
      return;
    }
    if (!montantNum || montantNum <= 0) {
      setError(t.erb.erreurMontantPositif);
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

  async function handleDelete(l: ErbLine) {
    setError(null);
    // .select() force la requete a renvoyer la ligne reellement supprimee -
    // sans ca, une policy RLS qui bloque silencieusement la suppression (0
    // ligne affectee, aucune erreur levee par Postgres) passerait inapercue.
    const { data, error: deleteError } = await supabase
      .from("erb_lines")
      .delete()
      .eq("id", l.id)
      .select("id");

    if (deleteError) {
      setError(`Erreur : ${deleteError.message}`);
      return;
    }
    if (!data || data.length === 0) {
      setError(t.erb.erreurSuppressionBloquee);
      return;
    }

    onAdded();
  }

  return (
    <div>
      <p className="mb-3 font-semibold text-text-primary">{titre}</p>

      <form
        onSubmit={handleSubmit}
        className="mb-4 rounded-xl border border-border-subtle bg-bg-card p-4"
      >
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label={t.erb.date}
            type="date"
            value={form.date_operation}
            onChange={(e) => setForm({ ...form, date_operation: e.target.value })}
          />
          <FormField
            label={t.erb.reference}
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
          />
          <div className="col-span-2">
            <FormField
              label={t.erb.operation}
              required
              value={form.operation}
              onChange={(e) => setForm({ ...form, operation: e.target.value })}
            />
          </div>
          <FormField
            label={t.erb.montant}
            required
            type="number"
            step="0.01"
            value={form.montant}
            onChange={(e) => setForm({ ...form, montant: e.target.value })}
          />
          <FormField label={t.erb.sens}>
            <select
              value={form.sens}
              onChange={(e) =>
                setForm({ ...form, sens: e.target.value as "debit" | "credit" })
              }
              className={fieldControlClass}
            >
              <option value="debit">{t.erb.debit}</option>
              <option value="credit">{t.erb.credit}</option>
            </select>
          </FormField>
        </div>
        {error && <p className="mb-2 text-xs text-accent-red">{error}</p>}
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? "..." : t.erb.ajouter}
        </PrimaryButton>
      </form>

      <div className="max-h-[65vh] overflow-auto rounded-xl border border-border-subtle print:max-h-none print:overflow-visible">
        <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
          <MiniTableHeader
            columns={
              showPointe
                ? [t.erb.colDate, t.erb.colReference, t.erb.colOperation, t.erb.colDebit, t.erb.colCredit, t.erb.colC, t.erb.colSolde, t.common.action]
                : [t.erb.colDate, t.erb.colReference, t.erb.colOperation, t.erb.colDebit, t.erb.colCredit, t.erb.colSolde, t.common.action]
            }
            align={
              showPointe
                ? ["left", "left", "left", "right", "right", "center", "right", "right"]
                : ["left", "left", "left", "right", "right", "right", "right"]
            }
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={showPointe ? 8 : 7}
                  className="px-2 py-3 text-center text-text-secondary"
                >
                  {t.erb.aucuneLigne}
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
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={() => handleDelete(l)}
                      className="text-accent-red hover:underline"
                    >
                      {t.common.supprimer}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {sorted.length > 0 && (
            <tfoot className="bg-bg-card font-semibold text-text-primary">
              <tr>
                <td className="px-2 py-1.5" colSpan={showPointe ? 5 : 4}>
                  {t.erb.solde}
                </td>
                <td className="px-2 py-1.5 text-right" colSpan={3}>
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
  const { t } = useLanguage();
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
      <NavigationSecondaire actuel="erb" />

      <h1 className="mb-2 text-2xl font-semibold text-text-primary">
        {t.erb.titre}
      </h1>
      <p className="mb-6 text-sm text-text-secondary">
        {t.erb.description}
      </p>

      <div
        className={`mb-6 rounded-xl border p-4 text-sm ${
          ecart === 0
            ? "border-accent-teal bg-bg-card-teal text-accent-teal"
            : "border-accent-amber bg-accent-amber/10 text-accent-amber"
        }`}
      >
        {t.erb.ecartEntreSoldes}{" "}
        <span className="font-bold">{ecart.toLocaleString("fr-FR")}</span>
        {ecart === 0 ? ` ${t.erb.rapprochementEquilibre}` : ` ${t.erb.aInvestiguer}`}
      </div>

      {loading ? (
        <p className="text-text-secondary">{t.common.chargement}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Colonne
            titre={t.erb.chezMoi}
            cote="CHEZ_MOI"
            lines={chezMoi}
            onAdded={loadLines}
            showPointe
          />
          <Colonne
            titre={t.erb.chezLaBanque}
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
