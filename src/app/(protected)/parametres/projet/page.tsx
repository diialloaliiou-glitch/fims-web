"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { hasRole } from "@/lib/roles";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Donor } from "@/lib/types";

export default function ParametresProjetPage() {
  const { profile, project } = useAuth();
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    });

    supabase
      .from("donors")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("nom")
      .then(({ data }) => {
        setDonors((data as Donor[]) ?? []);
        setLoading(false);
      });
  }, [project, profile]);

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
      setError("Titre et code du projet sont obligatoires.");
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
      })
      .eq("id", project.id);

    setSaving(false);

    if (updateError) {
      setError(`Erreur : ${updateError.message}`);
      return;
    }

    setSuccess("Informations du projet enregistrées.");
    setTimeout(() => window.location.reload(), 800);
  }

  if (!canManage) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">
          Paramètres du projet
        </h1>
        <p className="text-sm text-text-secondary">
          Ton rôle ({profile?.role}) ne permet pas de modifier les informations
          du projet — réservé à ADMIN_N1, ADMIN_SITE et RAF.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">
          Paramètres du projet
        </h1>
        <p className="text-sm text-text-secondary">Chargement...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        Paramètres du projet
      </h1>

      <form
        onSubmit={handleSubmit}
        className="max-w-3xl rounded-xl border border-border-subtle bg-bg-card p-6"
      >
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField
              label="Project Title"
              required
              value={form.nom_projet}
              onChange={(e) => setForm({ ...form, nom_projet: e.target.value })}
            />
          </div>
          <FormField
            label="Project Code"
            required
            value={form.code_projet}
            onChange={(e) => setForm({ ...form, code_projet: e.target.value })}
          />
          <FormField label="Donors">
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
          <FormField
            label="Country"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
          <FormField
            label="Bank account N°"
            value={form.bank_account_number}
            onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
          />
          <FormField
            label="Starting date"
            type="date"
            value={form.date_debut_projet}
            onChange={(e) => setForm({ ...form, date_debut_projet: e.target.value })}
          />
          <FormField
            label="Ending date"
            type="date"
            value={form.date_fin_projet}
            onChange={(e) => setForm({ ...form, date_fin_projet: e.target.value })}
          />
          <FormField label="Number Months" disabled value={nbMois != null ? String(nbMois) : ""} />
          <FormField
            label="Requested by"
            value={form.requested_by}
            onChange={(e) => setForm({ ...form, requested_by: e.target.value })}
          />
          <FormField
            label="Reviewed by"
            value={form.reviewed_by}
            onChange={(e) => setForm({ ...form, reviewed_by: e.target.value })}
          />
          <FormField
            label="Authorized by"
            value={form.authorized_by}
            onChange={(e) => setForm({ ...form, authorized_by: e.target.value })}
          />
        </div>

        {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}
        {success && <p className="mb-3 text-sm text-accent-teal">{success}</p>}

        <PrimaryButton type="submit" disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </PrimaryButton>
      </form>
    </div>
  );
}
