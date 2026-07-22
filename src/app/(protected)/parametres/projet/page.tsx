"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { hasRole } from "@/lib/roles";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Donor } from "@/lib/types";

function estNumerique(v: string) {
  return v.trim() !== "" && !isNaN(Number(v.trim()));
}

export default function ParametresProjetPage() {
  const { profile, project } = useAuth();
  const { t } = useLanguage();
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nouveauBailleurMode, setNouveauBailleurMode] = useState(false);
  const [nouveauBailleurNom, setNouveauBailleurNom] = useState("");
  const [savingBailleur, setSavingBailleur] = useState(false);
  const [erreurBailleur, setErreurBailleur] = useState<string | null>(null);

  const [form, setForm] = useState({
    nom_projet: "",
    code_projet: "",
    donor_id: "",
    country: "",
    date_debut_projet: "",
    date_fin_projet: "",
    bank_account_number: "",
    requested_by: "",
    reviewed_by: "",
    authorized_by: "",
    administrative_financial_manager: "",
    program_coordinator_president: "",
    devise: "",
    taux_conversion: "",
  });

  const canManage = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"]);

  useEffect(() => {
    if (!project || !profile) return;
    setForm({
      nom_projet: project.nom_projet,
      code_projet: project.code_projet,
      donor_id: project.donor_id != null ? String(project.donor_id) : "",
      country: project.country ?? "",
      date_debut_projet: project.date_debut_projet ?? "",
      date_fin_projet: project.date_fin_projet ?? "",
      bank_account_number: project.bank_account_number ?? "",
      requested_by: project.requested_by ?? "",
      reviewed_by: project.reviewed_by ?? "",
      authorized_by: project.authorized_by ?? "",
      administrative_financial_manager: project.administrative_financial_manager ?? "",
      program_coordinator_president: project.program_coordinator_president ?? "",
      devise: project.devise ?? "",
      taux_conversion: project.taux_conversion != null ? String(project.taux_conversion) : "",
    });

    loadDonors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, profile]);

  async function loadDonors() {
    if (!profile) return;
    const { data } = await supabase
      .from("donors")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("nom");
    setDonors((data as Donor[]) ?? []);
    setLoading(false);
  }

  async function handleAjouterBailleur() {
    setErreurBailleur(null);

    const nom = nouveauBailleurNom.trim();
    if (!nom) {
      setErreurBailleur(t.infoProjet.erreurNomBailleurObligatoire);
      return;
    }
    if (!profile) return;

    setSavingBailleur(true);
    const { data, error: insertError } = await supabase
      .from("donors")
      .insert({ organization_id: profile.organization_id, nom })
      .select("*")
      .single();
    setSavingBailleur(false);

    if (insertError) {
      setErreurBailleur(`Erreur : ${insertError.message}`);
      return;
    }

    await loadDonors();
    setForm((f) => ({ ...f, donor_id: String((data as Donor).id) }));
    setNouveauBailleurNom("");
    setNouveauBailleurMode(false);
  }

  // Reproduit =DATEDIF(C15,C16,"m")+1 de la feuille INFO PROJET Excel.
  const nbMois =
    form.date_debut_projet && form.date_fin_projet
      ? (() => {
          const debut = new Date(form.date_debut_projet);
          const fin = new Date(form.date_fin_projet);
          let mois =
            (fin.getFullYear() - debut.getFullYear()) * 12 +
            (fin.getMonth() - debut.getMonth());
          if (fin.getDate() < debut.getDate()) mois -= 1;
          return Math.max(0, mois) + 1;
        })()
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.nom_projet.trim() || !form.code_projet.trim()) {
      setError(t.infoProjet.erreurChampsObligatoires);
      return;
    }
    if (form.taux_conversion.trim() && !estNumerique(form.taux_conversion)) {
      setError(t.infoProjet.erreurTauxNumerique);
      return;
    }
    if (!project) return;

    setSaving(true);

    const { error: updateError } = await supabase
      .from("projects")
      .update({
        nom_projet: form.nom_projet.trim(),
        code_projet: form.code_projet.trim(),
        donor_id: form.donor_id ? parseInt(form.donor_id, 10) : null,
        country: form.country.trim() || null,
        date_debut_projet: form.date_debut_projet || null,
        date_fin_projet: form.date_fin_projet || null,
        bank_account_number: form.bank_account_number.trim() || null,
        requested_by: form.requested_by.trim() || null,
        reviewed_by: form.reviewed_by.trim() || null,
        authorized_by: form.authorized_by.trim() || null,
        administrative_financial_manager: form.administrative_financial_manager.trim() || null,
        program_coordinator_president: form.program_coordinator_president.trim() || null,
        devise: form.devise.trim() || null,
        taux_conversion: form.taux_conversion.trim() ? Number(form.taux_conversion) : null,
      })
      .eq("id", project.id);

    setSaving(false);

    if (updateError) {
      setError(`Erreur : ${updateError.message}`);
      return;
    }

    setSuccess(t.infoProjet.infosEnregistrees);
    setTimeout(() => window.location.reload(), 800);
  }

  if (!canManage) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">
          {t.infoProjet.titre}
        </h1>
        <p className="text-sm text-text-secondary">
          {t.infoProjet.permissionInfo.replace("{role}", profile?.role ?? "")}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">
          {t.infoProjet.titre}
        </h1>
        <p className="text-sm text-text-secondary">{t.common.chargement}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {t.infoProjet.titre}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="max-w-3xl rounded-xl border border-border-subtle bg-bg-card p-6"
      >
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField
              label={t.infoProjet.projectTitle}
              required
              value={form.nom_projet}
              onChange={(e) => setForm({ ...form, nom_projet: e.target.value })}
            />
          </div>
          <FormField
            label={t.infoProjet.projectCode}
            required
            value={form.code_projet}
            onChange={(e) => setForm({ ...form, code_projet: e.target.value })}
          />
          <div>
            <FormField label={t.infoProjet.donors}>
              <select
                value={form.donor_id}
                onChange={(e) => setForm({ ...form, donor_id: e.target.value })}
                className={fieldControlClass}
              >
                <option value="">—</option>
                {donors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nom}
                  </option>
                ))}
              </select>
            </FormField>
            {!nouveauBailleurMode ? (
              <button
                type="button"
                onClick={() => setNouveauBailleurMode(true)}
                className="mt-1 text-xs text-accent-blue hover:underline"
              >
                {t.infoProjet.nouveauBailleur}
              </button>
            ) : (
              <div className="mt-2 flex items-end gap-2">
                <div className="flex-1">
                  <FormField
                    label={t.infoProjet.nomDuBailleur}
                    value={nouveauBailleurNom}
                    onChange={(e) => setNouveauBailleurNom(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAjouterBailleur}
                  disabled={savingBailleur}
                  className="rounded-md bg-accent-teal px-3 py-2 text-sm font-medium text-on-accent-light hover:opacity-90 disabled:opacity-60"
                >
                  {savingBailleur ? t.common.enregistrement : t.infoProjet.ajouter}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNouveauBailleurMode(false);
                    setNouveauBailleurNom("");
                    setErreurBailleur(null);
                  }}
                  className="rounded-md border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-bg-card"
                >
                  {t.common.annuler}
                </button>
              </div>
            )}
            {erreurBailleur && (
              <p className="mt-1 text-xs text-accent-red">{erreurBailleur}</p>
            )}
          </div>
          <FormField
            label={t.infoProjet.country}
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
          <FormField
            label={t.infoProjet.bankAccountNo}
            value={form.bank_account_number}
            onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
          />
          <FormField
            label={t.infoProjet.devise}
            placeholder={t.infoProjet.devisePlaceholder}
            value={form.devise}
            onChange={(e) => setForm({ ...form, devise: e.target.value })}
          />
          <FormField
            label={t.infoProjet.tauxConversion}
            placeholder={t.infoProjet.tauxConversionPlaceholder}
            value={form.taux_conversion}
            onChange={(e) => setForm({ ...form, taux_conversion: e.target.value })}
          />
          <FormField
            label={t.infoProjet.startingDate}
            type="date"
            value={form.date_debut_projet}
            onChange={(e) => setForm({ ...form, date_debut_projet: e.target.value })}
          />
          <FormField
            label={t.infoProjet.endingDate}
            type="date"
            value={form.date_fin_projet}
            onChange={(e) => setForm({ ...form, date_fin_projet: e.target.value })}
          />
          <FormField label={t.infoProjet.numberMonths} disabled value={nbMois != null ? String(nbMois) : ""} />
          <FormField
            label={t.infoProjet.requestedBy}
            value={form.requested_by}
            onChange={(e) => setForm({ ...form, requested_by: e.target.value })}
          />
          <FormField
            label={t.infoProjet.reviewedBy}
            value={form.reviewed_by}
            onChange={(e) => setForm({ ...form, reviewed_by: e.target.value })}
          />
          <FormField
            label={t.infoProjet.authorizedBy}
            value={form.authorized_by}
            onChange={(e) => setForm({ ...form, authorized_by: e.target.value })}
          />
          <FormField
            label={t.infoProjet.administrativeFinancialManager}
            value={form.administrative_financial_manager}
            onChange={(e) =>
              setForm({ ...form, administrative_financial_manager: e.target.value })
            }
          />
          <FormField
            label={t.infoProjet.programCoordinatorPresident}
            value={form.program_coordinator_president}
            onChange={(e) =>
              setForm({ ...form, program_coordinator_president: e.target.value })
            }
          />
        </div>

        {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}
        {success && <p className="mb-3 text-sm text-accent-teal">{success}</p>}

        <PrimaryButton type="submit" disabled={saving}>
          {saving ? t.common.enregistrement : t.common.enregistrer}
        </PrimaryButton>
      </form>
    </div>
  );
}
