"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { hasRole } from "@/lib/roles";
import { FormField } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Secteur } from "@/lib/types";

export default function SecteursPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [secteurs, setSecteurs] = useState<Secteur[]>([]);
  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canManage = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"]);

  async function loadSecteurs() {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from("secteurs")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("nom");
    setSecteurs((data as Secteur[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadSecteurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nom.trim()) {
      setError(t.secteurs.erreurNomObligatoire);
      return;
    }
    if (!profile) return;

    setSaving(true);

    const { error: insertError } = await supabase.from("secteurs").insert({
      organization_id: profile.organization_id,
      nom: nom.trim(),
    });

    setSaving(false);

    if (insertError) {
      setError(`${t.common.erreur} : ${insertError.message}`);
      return;
    }

    setNom("");
    loadSecteurs();
  }

  async function handleDelete(s: Secteur) {
    setDeleteError(null);
    setDeletingId(s.id);

    const { count } = await supabase
      .from("budget_lines")
      .select("id", { count: "exact", head: true })
      .eq("secteur", s.nom);

    if (count && count > 0) {
      setDeletingId(null);
      setDeleteError(t.secteurs.erreurSecteurUtilise.replace("{count}", String(count)));
      return;
    }

    const { error: deleteErr } = await supabase.from("secteurs").delete().eq("id", s.id);

    setDeletingId(null);

    if (deleteErr) {
      setDeleteError(`${t.common.erreur} : ${deleteErr.message}`);
      return;
    }

    loadSecteurs();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">{t.secteurs.titre}</h1>
      <p className="mb-6 text-sm text-text-secondary">{t.secteurs.description}</p>

      {canManage && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 max-w-xl rounded-xl border border-border-subtle bg-bg-card p-6"
        >
          <p className="mb-4 text-sm font-medium text-text-secondary">{t.secteurs.ajouterSecteur}</p>
          <div className="mb-4">
            <FormField label={t.secteurs.libelle} required value={nom} onChange={(e) => setNom(e.target.value)} />
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
          <MiniTableHeader columns={[t.secteurs.colLibelle, t.common.action]} align={["left", "right"]} />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={2} className="px-3 py-4 text-center text-text-secondary">
                  {t.common.chargement}
                </td>
              </tr>
            )}
            {!loading && secteurs.length === 0 && (
              <tr>
                <td colSpan={2} className="px-3 py-4 text-center text-text-secondary">
                  {t.secteurs.aucunSecteur}
                </td>
              </tr>
            )}
            {secteurs.map((s) => (
              <tr key={s.id} className="text-text-primary">
                <td className="px-3 py-2">{s.nom}</td>
                <td className="px-3 py-2 text-right">
                  {canManage && (
                    <button
                      onClick={() => handleDelete(s)}
                      disabled={deletingId === s.id}
                      className="text-accent-red hover:underline disabled:opacity-60"
                    >
                      {deletingId === s.id ? t.common.enregistrement : t.common.supprimer}
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
