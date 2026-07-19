"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
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
      <h1 className="mb-6 text-2xl font-semibold text-fg-primary">
        Plan comptable
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 max-w-3xl rounded-xl border border-border-default bg-surface-1 p-6"
      >
        <p className="mb-4 text-sm font-medium text-fg-secondary">
          {editingId ? `Modifier le compte #${editingId}` : "Ajouter un compte"}
        </p>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-fg-secondary">
              Compte (classe) *
            </label>
            <input
              type="text"
              required
              value={form.compte}
              onChange={(e) => setForm({ ...form, compte: e.target.value })}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-fg-secondary">
              Sous-compte
            </label>
            <input
              type="text"
              value={form.sous_compte}
              onChange={(e) => setForm({ ...form, sous_compte: e.target.value })}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-fg-secondary">
              N° compte complet *
            </label>
            <input
              type="text"
              required
              value={form.ccompte}
              onChange={(e) => setForm({ ...form, ccompte: e.target.value })}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-fg-secondary">
              Libellé *
            </label>
            <input
              type="text"
              required
              value={form.libelle}
              onChange={(e) => setForm({ ...form, libelle: e.target.value })}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-fg-secondary">
              Type de compte
            </label>
            <select
              value={form.type_compte}
              onChange={(e) => setForm({ ...form, type_compte: e.target.value })}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            >
              <option value="">—</option>
              {TYPES_COMPTE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-fg-secondary">
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

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent-green px-5 py-2 font-medium text-on-accent hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Ajouter"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-md border border-border-default px-5 py-2 text-fg-secondary hover:bg-surface-2"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrer par compte ou libellé..."
        className="mb-4 w-full max-w-sm rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
      />

      <div className="overflow-x-auto rounded-xl border border-border-default">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-2 text-fg-secondary">
            <tr>
              <th className="px-3 py-2 text-left">N° compte</th>
              <th className="px-3 py-2 text-left">Libellé</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-center">Tiers</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default bg-surface-1/60">
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-fg-muted">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((a) => (
                <tr key={a.id} className="text-fg-primary">
                  <td className="px-3 py-2">{a.ccompte}</td>
                  <td className="px-3 py-2">{a.libelle}</td>
                  <td className="px-3 py-2 text-fg-muted">{a.type_compte}</td>
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
