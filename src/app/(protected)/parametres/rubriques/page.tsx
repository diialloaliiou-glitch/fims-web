"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { hasRole } from "@/lib/roles";
import { FormField } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Rubrique } from "@/lib/types";

const emptyForm = { rubrique: "", code: "" };

export default function RubriquesPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [rubriques, setRubriques] = useState<Rubrique[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canManage = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"]);

  async function loadRubriques() {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from("rubriques")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("rubrique");
    setRubriques((data as Rubrique[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadRubriques();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.rubrique.trim() || !form.code.trim()) {
      setError(t.rubriques.erreurChampsObligatoires);
      return;
    }
    if (!profile) return;

    setSaving(true);

    const { error: insertError } = await supabase.from("rubriques").insert({
      organization_id: profile.organization_id,
      rubrique: form.rubrique.trim(),
      code: form.code.trim().toUpperCase(),
    });

    setSaving(false);

    if (insertError) {
      setError(`${t.common.erreur} : ${insertError.message}`);
      return;
    }

    setForm(emptyForm);
    loadRubriques();
  }

  async function handleDelete(r: Rubrique) {
    setDeleteError(null);
    setDeletingId(r.id);

    const { count } = await supabase
      .from("budget_lines")
      .select("id", { count: "exact", head: true })
      .eq("rubrique", r.rubrique);

    if (count && count > 0) {
      setDeletingId(null);
      setDeleteError(t.rubriques.erreurRubriqueUtilisee.replace("{count}", String(count)));
      return;
    }

    const { error: deleteErr } = await supabase.from("rubriques").delete().eq("id", r.id);

    setDeletingId(null);

    if (deleteErr) {
      setDeleteError(`${t.common.erreur} : ${deleteErr.message}`);
      return;
    }

    loadRubriques();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">{t.rubriques.titre}</h1>
      <p className="mb-6 text-sm text-text-secondary">{t.rubriques.description}</p>

      {canManage && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 max-w-xl rounded-xl border border-border-subtle bg-bg-card p-6"
        >
          <p className="mb-4 text-sm font-medium text-text-secondary">
            {t.rubriques.ajouterRubrique}
          </p>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label={t.rubriques.libelle}
              required
              value={form.rubrique}
              onChange={(e) => setForm({ ...form, rubrique: e.target.value })}
            />
            <FormField
              label={t.rubriques.code}
              required
              placeholder={t.rubriques.codePlaceholder}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>

          {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

          <PrimaryButton type="submit" disabled={saving}>
            {saving ? t.common.enregistrement : t.common.creer}
          </PrimaryButton>
        </form>
      )}

      {deleteError && <p className="mb-4 text-sm text-accent-red">{deleteError}</p>}

      <div className="max-h-[65vh] overflow-auto rounded-xl border border-border-subtle print:max-h-none print:overflow-visible">
        <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
          <MiniTableHeader
            columns={[t.rubriques.colLibelle, t.rubriques.colCode, t.common.action]}
            align={["left", "left", "right"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-text-secondary">
                  {t.common.chargement}
                </td>
              </tr>
            )}
            {!loading && rubriques.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-text-secondary">
                  {t.rubriques.aucuneRubrique}
                </td>
              </tr>
            )}
            {rubriques.map((r) => (
              <tr key={r.id} className="text-text-primary">
                <td className="px-3 py-2">{r.rubrique}</td>
                <td className="px-3 py-2 text-text-secondary">{r.code}</td>
                <td className="px-3 py-2 text-right">
                  {canManage && (
                    <button
                      onClick={() => handleDelete(r)}
                      disabled={deletingId === r.id}
                      className="text-accent-red hover:underline disabled:opacity-60"
                    >
                      {deletingId === r.id ? t.common.enregistrement : t.common.supprimer}
                    </button>
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
