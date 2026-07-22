"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { hasRole } from "@/lib/roles";
import { FormField } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { ProjectOutput } from "@/lib/types";

const emptyForm = { code: "", label: "" };

export default function OutputsPage() {
  const { profile, project } = useAuth();
  const { t } = useLanguage();
  const [outputs, setOutputs] = useState<ProjectOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canManage = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"]);

  async function loadOutputs() {
    if (!project) return;
    setLoading(true);
    const { data } = await supabase
      .from("project_outputs")
      .select("*")
      .eq("project_id", project.id)
      .order("ordre");
    setOutputs((data as ProjectOutput[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadOutputs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.code.trim() || !form.label.trim()) {
      setError(t.outputs.erreurChampsObligatoires);
      return;
    }
    if (!project || !profile) return;

    setSaving(true);

    const { error: insertError } = await supabase.from("project_outputs").insert({
      organization_id: profile.organization_id,
      project_id: project.id,
      code: form.code.trim().toUpperCase(),
      label: form.label.trim(),
      ordre: outputs.length,
    });

    setSaving(false);

    if (insertError) {
      setError(`${t.common.erreur} : ${insertError.message}`);
      return;
    }

    setForm(emptyForm);
    loadOutputs();
  }

  async function handleDelete(o: ProjectOutput) {
    setDeleteError(null);
    setDeletingId(o.id);

    const { count } = await supabase
      .from("budget_lines")
      .select("id", { count: "exact", head: true })
      .eq("output_id", o.id);

    if (count && count > 0) {
      setDeletingId(null);
      setDeleteError(t.outputs.erreurOutputUtilise.replace("{count}", String(count)));
      return;
    }

    const { error: deleteErr } = await supabase.from("project_outputs").delete().eq("id", o.id);

    setDeletingId(null);

    if (deleteErr) {
      setDeleteError(`${t.common.erreur} : ${deleteErr.message}`);
      return;
    }

    loadOutputs();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">{t.outputs.titre}</h1>
      <p className="mb-6 text-sm text-text-secondary">{t.outputs.description}</p>

      {canManage && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 max-w-xl rounded-xl border border-border-subtle bg-bg-card p-6"
        >
          <p className="mb-4 text-sm font-medium text-text-secondary">
            {t.outputs.ajouterOutput}
          </p>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label={t.outputs.code}
              required
              placeholder={t.outputs.codePlaceholder}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <FormField
              label={t.outputs.libelle}
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
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
            columns={[t.outputs.colCode, t.outputs.colLibelle, t.common.action]}
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
            {!loading && outputs.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-text-secondary">
                  {t.outputs.aucunOutput}
                </td>
              </tr>
            )}
            {outputs.map((o) => (
              <tr key={o.id} className="text-text-primary">
                <td className="px-3 py-2">{o.code}</td>
                <td className="px-3 py-2 text-text-secondary">{o.label}</td>
                <td className="px-3 py-2 text-right">
                  {canManage && (
                    <button
                      onClick={() => handleDelete(o)}
                      disabled={deletingId === o.id}
                      className="text-accent-red hover:underline disabled:opacity-60"
                    >
                      {deletingId === o.id ? t.common.enregistrement : t.common.supprimer}
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
