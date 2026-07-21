"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { ChartOfAccount } from "@/lib/types";

// Liste exacte de la validation de liste deroulante "TYPE COMPTE" (colonne O
// de la feuille PLAN COMPTA du fichier BASE Excel).
const TYPES_COMPTE = [
  "CAPITAUX",
  "IMMOBILISATION",
  "STOCK",
  "TIERS",
  "BANQUE",
  "CAISSE",
  "TRESORERIE",
  "CHARGE",
  "PRODUIT",
];

const emptyForm = {
  ccompte: "",
  libelle: "",
  type_compte: "",
  compte_tiers: false,
};

export default function PlanComptablePage() {
  const { profile, project } = useAuth();
  const { t } = useLanguage();
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
      ccompte: a.ccompte,
      libelle: a.libelle,
      type_compte: a.type_compte ?? "",
      compte_tiers: a.compte_tiers ?? false,
    });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.ccompte.trim() || !form.libelle.trim()) {
      setError(t.planComptable.erreurChampsObligatoires);
      return;
    }
    if (!project || !profile) return;

    setSaving(true);

    const ccompte = form.ccompte.trim();
    const libelle = form.libelle.trim();

    // COMPTE, SOUS COMPTE et S-COMPTE sont des formules dans le fichier
    // Excel (=LEFT(CCOMPTE,1), =LEFT(CCOMPTE,3), =CONCAT(CCOMPTE,".",LIBELLE))
    // — jamais saisis a la main, on les derive donc ici a l'identique.
    const payload = {
      compte: ccompte.slice(0, 1),
      sous_compte: ccompte.slice(0, 3),
      ccompte,
      s_compte: `${ccompte}.${libelle}`,
      libelle,
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
        {t.planComptable.titre}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 max-w-3xl rounded-xl border border-border-subtle bg-bg-card p-6"
      >
        <p className="mb-4 text-sm font-medium text-text-secondary">
          {editingId ? `${t.planComptable.modifierCompte}${editingId}` : t.planComptable.ajouterCompte}
        </p>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            label={t.planComptable.nCompteComplet}
            required
            value={form.ccompte}
            onChange={(e) => setForm({ ...form, ccompte: e.target.value })}
          />
          <div className="sm:col-span-2">
            <FormField
              label={t.planComptable.libelle}
              required
              value={form.libelle}
              onChange={(e) => setForm({ ...form, libelle: e.target.value })}
            />
          </div>
          <FormField label={t.planComptable.typeCompte}>
            <select
              value={form.type_compte}
              onChange={(e) => setForm({ ...form, type_compte: e.target.value })}
              className={fieldControlClass}
            >
              <option value="">—</option>
              {TYPES_COMPTE.map((tc) => (
                <option key={tc} value={tc}>
                  {tc}
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
              {t.planComptable.compteDeTiers}
            </label>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

        <div className="flex gap-3">
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? t.common.enregistrement : editingId ? t.common.mettreAJour : t.common.ajouter}
          </PrimaryButton>
          {editingId && (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-md border border-border-subtle px-5 py-2 text-text-secondary hover:bg-bg-card"
            >
              {t.common.annuler}
            </button>
          )}
        </div>
      </form>

      <div className="mb-4 max-w-sm">
        <FormField
          label={t.planComptable.filtrer}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t.planComptable.filtrerPlaceholder}
        />
      </div>

      <div className="max-h-[65vh] overflow-auto rounded-xl border border-border-subtle print:max-h-none print:overflow-visible">
        <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
          <MiniTableHeader
            columns={[t.planComptable.colNCompte, t.planComptable.colLibelle, t.planComptable.colType, t.planComptable.colTiers, t.common.action]}
            align={["left", "left", "left", "center", "right"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-text-secondary">
                  {t.common.chargement}
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
                      {t.common.modifier}
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
