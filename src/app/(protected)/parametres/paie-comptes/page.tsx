"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { hasRole } from "@/lib/roles";
import { PAYROLL_MAPPING_KEYS } from "@/lib/paie";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { ChartOfAccount, PayrollAccountMapping, PayrollMappingKey } from "@/lib/types";

export default function PaieComptesPage() {
  const { profile, project } = useAuth();
  const { t } = useLanguage();

  const peutGerer = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"]);

  const [comptes, setComptes] = useState<ChartOfAccount[]>([]);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setLoading(true);

    supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("project_id", project.id)
      .order("ccompte")
      .then(({ data }) => setComptes((data as ChartOfAccount[]) ?? []));

    supabase
      .from("payroll_account_mapping")
      .select("*")
      .eq("project_id", project.id)
      .then(({ data }) => {
        const rows = (data as PayrollAccountMapping[]) ?? [];
        const map: Record<string, string> = {};
        rows.forEach((r) => (map[r.cle] = r.compte));
        setValeurs(map);
        setLoading(false);
      });
  }, [project]);

  function suggererValeurs() {
    setValeurs((current) => {
      const next = { ...current };
      PAYROLL_MAPPING_KEYS.forEach((k) => {
        if (!next[k.cle]) next[k.cle] = k.compteSuggere;
      });
      return next;
    });
  }

  async function handleSave() {
    if (!project) return;
    setError(null);
    setSuccess(null);

    const manquants = PAYROLL_MAPPING_KEYS.filter((k) => !valeurs[k.cle]?.trim());
    if (manquants.length > 0) {
      setError(
        `${t.paieComptes.erreurComptesManquants} ${manquants.map((m) => m.libelle).join(", ")}`
      );
      return;
    }

    setSaving(true);

    await supabase.from("payroll_account_mapping").delete().eq("project_id", project.id);

    const { error: insertError } = await supabase.from("payroll_account_mapping").insert(
      PAYROLL_MAPPING_KEYS.map((k) => ({
        organization_id: project.organization_id,
        project_id: project.id,
        cle: k.cle as PayrollMappingKey,
        compte: valeurs[k.cle].trim(),
      }))
    );

    setSaving(false);

    if (insertError) {
      setError(`Erreur : ${insertError.message}`);
      return;
    }

    setSuccess(t.paieComptes.enregistre);
  }

  if (!peutGerer) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">{t.paieComptes.titre}</h1>
        <p className="text-sm text-text-secondary">{t.paieComptes.acceRefuse}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-text-primary">{t.paieComptes.titre}</h1>
      <p className="mb-6 text-sm text-text-secondary">
        {t.paieComptes.description} {project?.code_projet}.
      </p>

      {loading ? (
        <p className="text-sm text-text-secondary">{t.common.chargement}</p>
      ) : (
        <div className="max-w-2xl rounded-xl border border-border-subtle bg-bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-text-secondary">{t.paieComptes.les9Cles}</p>
            <button onClick={suggererValeurs} className="text-sm text-accent-teal hover:underline">
              {t.paieComptes.suggererValeurs}
            </button>
          </div>

          <div className="mb-4 flex flex-col gap-3">
            {PAYROLL_MAPPING_KEYS.map((k) => (
              <div key={k.cle} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_180px]">
                <p className="text-sm text-text-primary">{k.libelle}</p>
                <div>
                  <input
                    list={`comptes-list-${k.cle}`}
                    type="text"
                    value={valeurs[k.cle] ?? ""}
                    onChange={(e) => setValeurs({ ...valeurs, [k.cle]: e.target.value })}
                    className="w-full rounded-xl border border-border-subtle bg-bg-card px-3 py-2 text-text-primary outline-none transition-shadow focus:border-accent-teal focus:shadow-[0_0_0_3px_rgba(52,224,176,0.15)]"
                  />
                  <datalist id={`comptes-list-${k.cle}`}>
                    {comptes.map((c) => (
                      <option key={c.id} value={c.ccompte}>
                        {c.libelle}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}
          {success && <p className="mb-3 text-sm text-accent-teal">{success}</p>}

          <PrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? t.common.enregistrement : t.common.enregistrer}
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
