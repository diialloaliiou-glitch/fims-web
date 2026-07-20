"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { hasRole } from "@/lib/roles";
import type { BudgetLineStaging, Rubrique } from "@/lib/types";

const emptyForm = {
  code_1: "",
  budget_line: "",
  our_line_code: "",
  description: "",
  rubrique: "",
  unit: "",
  quantity: "",
  frequence: "",
  t_pec: "",
  devise: "",
  unit_cost_devise: "",
  taux_conversion: "",
  note: "",
};

export default function BudgetStagingPage() {
  const { profile, project } = useAuth();
  const [rows, setRows] = useState<BudgetLineStaging[]>([]);
  const [rubriques, setRubriques] = useState<Rubrique[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [validatingId, setValidatingId] = useState<number | null>(null);
  const [unitCostInput, setUnitCostInput] = useState("");
  const [validateError, setValidateError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const canValidate = hasRole(profile?.role, ["ADMIN_SITE", "RAF"]);

  async function loadRows() {
    if (!project) return;
    setLoading(true);
    const { data } = await supabase
      .from("budget_lines_staging")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    setRows((data as BudgetLineStaging[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadRows();
    if (project) {
      supabase
        .from("rubriques")
        .select("*")
        .eq("organization_id", project.organization_id)
        .order("rubrique")
        .then(({ data }) => setRubriques((data as Rubrique[]) ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function startEdit(r: BudgetLineStaging) {
    setEditingId(r.id);
    setForm({
      code_1: r.code_1,
      budget_line: r.budget_line ?? "",
      our_line_code: r.our_line_code ?? "",
      description: r.description ?? "",
      rubrique: r.rubrique ?? "",
      unit: r.unit ?? "",
      quantity: r.quantity != null ? String(r.quantity) : "",
      frequence: r.frequence != null ? String(r.frequence) : "",
      t_pec: r.t_pec ?? "",
      devise: r.devise ?? "",
      unit_cost_devise: r.unit_cost_devise != null ? String(r.unit_cost_devise) : "",
      taux_conversion: r.taux_conversion != null ? String(r.taux_conversion) : "",
      note: r.note ?? "",
    });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.code_1.trim() || !form.description.trim()) {
      setError("Code et description sont obligatoires.");
      return;
    }
    if (!project || !profile) return;

    setSaving(true);

    const payload = {
      code_1: form.code_1.trim(),
      budget_line: form.budget_line.trim() || null,
      our_line_code: form.our_line_code.trim() || null,
      description: form.description.trim(),
      rubrique: form.rubrique || null,
      unit: form.unit.trim() || null,
      quantity: form.quantity ? parseFloat(form.quantity) : null,
      frequence: form.frequence ? parseFloat(form.frequence) : null,
      t_pec: form.t_pec.trim() || null,
      devise: form.devise.trim() || null,
      unit_cost_devise: form.unit_cost_devise ? parseFloat(form.unit_cost_devise) : null,
      taux_conversion: form.taux_conversion ? parseFloat(form.taux_conversion) : null,
      note: form.note.trim() || null,
    };

    const result = editingId
      ? await supabase.from("budget_lines_staging").update(payload).eq("id", editingId)
      : await supabase.from("budget_lines_staging").insert({
          ...payload,
          organization_id: profile.organization_id,
          project_id: project.id,
          statut: "En attente",
        });

    setSaving(false);

    if (result.error) {
      setError(`Erreur : ${result.error.message}`);
      return;
    }

    startCreate();
    loadRows();
  }

  function openValidate(id: number) {
    setValidatingId(id);
    setUnitCostInput("");
    setValidateError(null);
  }

  async function confirmValidate(row: BudgetLineStaging) {
    setValidateError(null);
    const unitCost = parseFloat(unitCostInput);

    if (isNaN(unitCost) || unitCost < 0) {
      setValidateError("Indique un coût unitaire valide (0 ou plus).");
      return;
    }
    if (!project || !profile) return;

    setValidating(true);

    const totalCost =
      row.quantity != null && row.frequence != null
        ? row.quantity * row.frequence * unitCost
        : unitCost;

    const categorie =
      rubriques.find((r) => r.rubrique === row.rubrique)?.code ?? null;

    const { error: insertError } = await supabase.from("budget_lines").insert({
      organization_id: profile.organization_id,
      project_id: project.id,
      code_1: row.code_1,
      icp: row.icp,
      budget_line: row.budget_line,
      our_line_code: row.our_line_code,
      description: row.description,
      rubrique: row.rubrique,
      categorie,
      unit: row.unit,
      quantity: row.quantity,
      frequence: row.frequence,
      unit_cost: unitCost,
      total_cost: totalCost,
      ajustement: row.ajustement,
      note: row.note,
      t_pec: row.t_pec,
      unit_cost_devise: row.unit_cost_devise,
      devise: row.devise,
      taux_conversion: row.taux_conversion,
      t_ic: row.t_ic,
    });

    if (insertError) {
      setValidating(false);
      setValidateError(`Erreur : ${insertError.message}`);
      return;
    }

    const { error: updateError } = await supabase
      .from("budget_lines_staging")
      .update({ statut: "Validée" })
      .eq("id", row.id);

    setValidating(false);

    if (updateError) {
      setValidateError(`Ligne créée dans le budget, mais le statut n'a pas pu être mis à jour : ${updateError.message}`);
      return;
    }

    setValidatingId(null);
    loadRows();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">
          Propositions budgétaires
        </h1>
        <Link href="/budget" className="text-sm text-accent-blue hover:underline">
          Voir le Financial Report →
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mb-6 max-w-3xl rounded-xl border border-border-subtle bg-bg-card p-6"
      >
        <p className="mb-4 text-sm font-medium text-text-secondary">
          {editingId ? `Modifier la proposition #${editingId}` : "Proposer une ligne budgétaire"}
        </p>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            label="Code"
            required
            value={form.code_1}
            onChange={(e) => setForm({ ...form, code_1: e.target.value })}
          />
          <FormField
            label="Ligne budgétaire"
            value={form.budget_line}
            onChange={(e) => setForm({ ...form, budget_line: e.target.value })}
          />
          <FormField
            label="Code interne"
            value={form.our_line_code}
            onChange={(e) => setForm({ ...form, our_line_code: e.target.value })}
          />
          <div className="sm:col-span-3">
            <FormField
              label="Description"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <FormField label="Rubrique">
            <select
              value={form.rubrique}
              onChange={(e) => setForm({ ...form, rubrique: e.target.value })}
              className={fieldControlClass}
            >
              <option value="">—</option>
              {rubriques.map((r) => (
                <option key={r.id} value={r.rubrique}>
                  {r.rubrique}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Unité"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
          <FormField
            label="Quantité"
            type="number"
            step="0.01"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
          <FormField
            label="Fréquence"
            type="number"
            step="0.01"
            value={form.frequence}
            onChange={(e) => setForm({ ...form, frequence: e.target.value })}
          />
          <FormField
            label="% pris en charge (T-PEC)"
            value={form.t_pec}
            onChange={(e) => setForm({ ...form, t_pec: e.target.value })}
          />
          <FormField
            label="Devise"
            value={form.devise}
            onChange={(e) => setForm({ ...form, devise: e.target.value })}
          />
          <FormField
            label="Coût unitaire (devise)"
            type="number"
            step="0.01"
            value={form.unit_cost_devise}
            onChange={(e) => setForm({ ...form, unit_cost_devise: e.target.value })}
          />
          <FormField
            label="Taux de conversion"
            type="number"
            step="0.0001"
            value={form.taux_conversion}
            onChange={(e) => setForm({ ...form, taux_conversion: e.target.value })}
          />
          <div className="sm:col-span-3">
            <FormField
              label="Note"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

        <div className="flex gap-3">
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Proposer"}
          </PrimaryButton>
          {editingId && (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-md border border-border-subtle px-5 py-2 text-text-secondary hover:bg-bg-card"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      {!canValidate && (
        <p className="mb-4 text-sm text-text-secondary">
          Ton rôle ({profile?.role}) permet de proposer des lignes, mais seul un
          ADMIN_SITE, RAF (ou ADMIN_N1) peut les valider et les transférer au budget officiel.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-full text-sm">
          <MiniTableHeader
            columns={["Code", "Description", "Rubrique", "Qté", "Statut", "Action"]}
            align={["left", "left", "left", "right", "left", "right"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-text-secondary">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-text-secondary">
                  Aucune proposition pour ce projet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="text-text-primary">
                <td className="px-3 py-2">{r.code_1}</td>
                <td className="px-3 py-2">{r.description}</td>
                <td className="px-3 py-2 text-text-secondary">{r.rubrique}</td>
                <td className="px-3 py-2 text-right">{r.quantity ?? ""}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      r.statut === "Validée"
                        ? "rounded-full bg-bg-card-teal px-2 py-0.5 text-xs text-accent-teal"
                        : "rounded-full bg-accent-amber/10 px-2 py-0.5 text-xs text-accent-amber"
                    }
                  >
                    {r.statut}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {r.statut !== "Validée" && (
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => startEdit(r)}
                        className="text-accent-blue hover:underline"
                      >
                        Modifier
                      </button>
                      {canValidate && (
                        <button
                          onClick={() => openValidate(r.id)}
                          className="text-accent-teal hover:underline"
                        >
                          Valider
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {validatingId !== null && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-bg-card p-6">
            <p className="mb-4 font-medium text-text-primary">
              Valider la proposition #{validatingId}
            </p>
            <div className="mb-3">
              <FormField
                label="Coût unitaire (FCFA)"
                required
                type="number"
                step="0.01"
                value={unitCostInput}
                onChange={(e) => setUnitCostInput(e.target.value)}
              />
            </div>
            <p className="mb-3 text-xs text-text-secondary">
              Le coût total sera calculé automatiquement (quantité × fréquence ×
              coût unitaire), et la ligne sera ajoutée au budget officiel du
              projet.
            </p>
            {validateError && (
              <p className="mb-3 text-sm text-accent-red">{validateError}</p>
            )}
            <div className="flex gap-3">
              <PrimaryButton
                onClick={() => {
                  const row = rows.find((r) => r.id === validatingId);
                  if (row) confirmValidate(row);
                }}
                disabled={validating}
              >
                {validating ? "Validation..." : "Confirmer"}
              </PrimaryButton>
              <button
                onClick={() => setValidatingId(null)}
                className="rounded-md border border-border-subtle px-4 py-2 text-text-secondary hover:bg-bg-card"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
