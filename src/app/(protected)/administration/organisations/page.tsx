"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { hasRole } from "@/lib/roles";
import { FormField } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Organization } from "@/lib/types";

export default function OrganisationsPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = hasRole(profile?.role, ["ADMIN_N1"]);

  async function loadAll() {
    setLoading(true);
    const { data } = await supabase.from("organizations").select("*").order("nom");
    setOrganizations((data as Organization[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (canManage) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nom.trim()) {
      setError(t.organisations.erreurNomObligatoire);
      return;
    }

    setSaving(true);

    const { data: created, error: insertError } = await supabase
      .from("organizations")
      .insert({ nom: nom.trim(), actif: true })
      .select("id")
      .single();

    setSaving(false);

    if (insertError) {
      setError(`${t.common.erreur} : ${insertError.message}`);
      return;
    }
    if (!created) {
      setError(`${t.common.erreur} : ${t.organisations.aucuneOrganisation}`);
      return;
    }

    setNom("");
    loadAll();
  }

  async function toggleActif(o: Organization) {
    await supabase.from("organizations").update({ actif: !o.actif }).eq("id", o.id);
    loadAll();
  }

  if (!canManage) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">{t.organisations.titre}</h1>
        <p className="text-sm text-text-secondary">
          {t.organisations.permissionInfo.replace("{role}", profile?.role ?? "")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">{t.organisations.titre}</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 max-w-xl rounded-xl border border-border-subtle bg-bg-card p-6"
      >
        <p className="mb-4 text-sm font-medium text-text-secondary">
          {t.organisations.creerOrganisation}
        </p>
        <div className="mb-4">
          <FormField
            label={t.organisations.nomOrganisation}
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
        </div>

        {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

        <PrimaryButton type="submit" disabled={saving}>
          {saving ? t.common.creation : t.common.creer}
        </PrimaryButton>
      </form>

      <div className="max-h-[65vh] overflow-auto rounded-xl border border-border-subtle print:max-h-none print:overflow-visible">
        <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
          <MiniTableHeader
            columns={[t.organisations.colNom, t.organisations.colStatut]}
            align={["left", "left"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={2} className="px-3 py-4 text-center text-text-secondary">
                  {t.common.chargement}
                </td>
              </tr>
            )}
            {!loading && organizations.length === 0 && (
              <tr>
                <td colSpan={2} className="px-3 py-4 text-center text-text-secondary">
                  {t.organisations.aucuneOrganisation}
                </td>
              </tr>
            )}
            {organizations.map((o) => (
              <tr key={o.id} className="text-text-primary">
                <td className="px-3 py-2">{o.nom}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggleActif(o)}
                    className={
                      o.actif
                        ? "rounded-full bg-bg-card-teal px-2 py-0.5 text-xs text-accent-teal"
                        : "rounded-full bg-accent-red/10 px-2 py-0.5 text-xs text-accent-red"
                    }
                  >
                    {o.actif ? t.common.actif : t.common.desactive}
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
