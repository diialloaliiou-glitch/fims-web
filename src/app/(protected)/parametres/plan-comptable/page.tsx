"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { ChartOfAccount } from "@/lib/types";

const TYPES_COMPTE = [
  "CAPITAUX",
  "IMMOBILISATION",
  "TIERS",
  "BANQUE",
  "TRESORERIE",
  "CHARGE",
  "PRODUIT",
];

const emptyForm = {
  compte: "",
  sous_compte: "",
  ccompte: "",
  s_compte: "",
  libelle: "",
  type_compte: "",
  compte_tiers: false,
};

export default function PlanComptablePage() {
  const { profile, project } = useAuth();
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function loadAccounts() {
    if (!project) return;
    setLoading(true);
    const { data } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("project_id", project.id)
      .order("ccompte");
    setAccounts((data as ChartOfAccount[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function startEdit(a: ChartOfAccount) {
    setEditingId(a.id);
    setForm({
      compte: a.compte,
      sous_compte: a.sous_compte ?? "",
      ccompte: a.ccompte,
      s_compte: a.s_compte ?? "",
      libelle: a.libelle,
      type_compte: a.type_compte ?? "",
      compte_tiers: a.compte_tiers ?? false,
    });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.compte.trim() || !form.ccompte.trim() || !form.libelle.trim()) {
      setError("Compte, N° de compte complet et Libellé sont obligatoires.");
      return;
    }
    if (!project || !profile) return;

    setSaving(true);

    const payload = {
      compte: form.compte.trim(),
      sous_compte: form.sous_compte.trim() || null,
      ccompte: form.ccompte.trim(),
      s_compte: form.s_compte.trim() || null,
      libelle: form.libelle.trim(),
      type_compte: form.type_compte || null,
      compte_tiers: form.compte_tiers,
    };

    const result = editingId
      ? await supabase.from("chart_of_accounts").update(payload).eq("id", editingId)
      : await supabase.from("chart_of_accounts").insert({
          ...payload,
          organization_id: profile.organization_id,
          project_id: project.id,
        });

    setSaving(false);

    if (result.error) {
      setError(`Erreur : ${result.error.message}`);
      return;
    }

    startCreate();
    loadAccounts();
  }

  const filtered = accounts.filter((a) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      a.ccompte.toLowerCase().includes(q) || a.libelle.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        Plan comptable
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 max-w-3xl rounded-xl border border-border-subtle bg-bg-card p-6"
      >
        <p className="mb-4 text-sm font-medium text-text-secondary">
          {editingId ? `Modifier le compte #${editingId}` : "Ajouter un compte"}
        </p>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            label="Compte (classe)"
            required
            value={form.compte}
            onChange={(e) => setForm({ ...form, compte: e.target.value })}
          />
          <FormField
            label="Sous-compte"
            value={form.sous_compte}
            onChange={(e) => setForm({ ...form, sous_compte: e.target.value })}
          />
          <FormField
            label="N° compte complet"
            required
            value={form.ccompte}
            onChange={(e) => setForm({ ...form, ccompte: e.target.value })}
          />
          <div className="sm:col-span-2">
            <FormField
              label="Libellé"
              required
              value={form.libelle}
              onChange={(e) => setForm({ ...form, libelle: e.target.value })}
            />
          </div>
          <FormField label="Type de compte">
            <select
              value={form.type_compte}
              onChange={(e) => setForm({ ...form, type_compte: e.target.value })}
              className={fieldControlClass}
            >
              <option value="">—</option>
              {TYPES_COMPTE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={form.compte_tiers}
                onChange={(e) =>
                  setForm({ ...form, compte_tiers: e.target.checked })
                }
              />
              Compte de tiers
            </label>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

        <div className="flex gap-3">
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Ajouter"}
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

      <div className="mb-4 max-w-sm">
        <FormField
          label="Filtrer"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Compte ou libellé..."
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-full text-sm">
          <MiniTableHeader
            columns={["N° compte", "Libellé", "Type", "Tiers", "Action"]}
            align={["left", "left", "left", "center", "right"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-text-secondary">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((a) => (
                <tr key={a.id} className="text-text-primary">
                  <td className="px-3 py-2">{a.ccompte}</td>
                  <td className="px-3 py-2">{a.libelle}</td>
                  <td className="px-3 py-2 text-text-secondary">{a.type_compte}</td>
                  <td className="px-3 py-2 text-center">
                    {a.compte_tiers ? "✓" : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => startEdit(a)}
                      className="text-accent-blue hover:underline"
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
