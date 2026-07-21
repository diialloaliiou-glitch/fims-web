"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { hasRole } from "@/lib/roles";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { License, Organization } from "@/lib/types";

const TYPES_LICENCE = ["ANNUELLE", "PERMANENTE", "DEMO"];

const emptyForm = {
  organization_id: "",
  type: TYPES_LICENCE[0],
  date_expiration: "",
  note: "",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function LicencesPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = hasRole(profile?.role, ["ADMIN_N1"]);

  async function loadAll() {
    setLoading(true);
    const [{ data: orgsData }, { data: licensesData }] = await Promise.all([
      supabase.from("organizations").select("*").order("nom"),
      supabase.from("licenses").select("*").order("created_at", { ascending: false }),
    ]);
    setOrganizations((orgsData as Organization[]) ?? []);
    setLicenses((licensesData as License[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (canManage) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  function estValide(l: License) {
    return l.actif && (l.date_expiration === null || l.date_expiration >= todayIso());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.organization_id) {
      setError(t.licences.erreurOrganisationObligatoire);
      return;
    }

    setSaving(true);

    const { error: insertError } = await supabase.from("licenses").insert({
      organization_id: form.organization_id,
      type: form.type,
      date_expiration: form.date_expiration || null,
      note: form.note.trim() || null,
      actif: true,
    });

    setSaving(false);

    if (insertError) {
      setError(`${t.common.erreur} : ${insertError.message}`);
      return;
    }

    setForm(emptyForm);
    loadAll();
  }

  async function toggleActif(l: License) {
    await supabase.from("licenses").update({ actif: !l.actif }).eq("id", l.id);
    loadAll();
  }

  if (!canManage) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">{t.licences.titre}</h1>
        <p className="text-sm text-text-secondary">
          {t.licences.permissionInfo.replace("{role}", profile?.role ?? "")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">{t.licences.titre}</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 max-w-2xl rounded-xl border border-border-subtle bg-bg-card p-6"
      >
        <p className="mb-4 text-sm font-medium text-text-secondary">{t.licences.creerLicence}</p>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t.licences.organisation} required>
            <select
              value={form.organization_id}
              onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
              className={fieldControlClass}
            >
              <option value="">—</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t.licences.type} required>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className={fieldControlClass}
            >
              {TYPES_LICENCE.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label={t.licences.dateExpiration}
            type="date"
            value={form.date_expiration}
            onChange={(e) => setForm({ ...form, date_expiration: e.target.value })}
          />
          <FormField
            label={t.common.libelle}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>

        {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

        <PrimaryButton type="submit" disabled={saving}>
          {saving ? t.common.enregistrement : t.common.creer}
        </PrimaryButton>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-full text-sm">
          <MiniTableHeader
            columns={[
              t.licences.colOrganisation,
              t.licences.colType,
              t.licences.colDateExpiration,
              t.common.statut,
              t.common.action,
            ]}
            align={["left", "left", "left", "left", "right"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-text-secondary">
                  {t.common.chargement}
                </td>
              </tr>
            )}
            {!loading && licenses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-text-secondary">
                  {t.licences.aucuneLicence}
                </td>
              </tr>
            )}
            {licenses.map((l) => {
              const org = organizations.find((o) => o.id === l.organization_id);
              const valide = estValide(l);
              return (
                <tr key={l.id} className="text-text-primary">
                  <td className="px-3 py-2">{org?.nom ?? l.organization_id}</td>
                  <td className="px-3 py-2 text-text-secondary">{l.type}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {l.date_expiration
                      ? new Date(l.date_expiration).toLocaleDateString("fr-FR")
                      : t.licences.sansExpiration}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleActif(l)}
                      className={
                        valide
                          ? "rounded-full bg-bg-card-teal px-2 py-0.5 text-xs text-accent-teal"
                          : "rounded-full bg-accent-red/10 px-2 py-0.5 text-xs text-accent-red"
                      }
                    >
                      {valide ? t.licences.valide : t.licences.expireeOuInactive}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary">{l.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
