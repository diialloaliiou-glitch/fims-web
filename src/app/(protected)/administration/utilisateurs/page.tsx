"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { assignableRoles, hasRole } from "@/lib/roles";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Profile } from "@/lib/types";

const emptyForm = {
  nom_utilisateur: "",
  email: "",
  password: "",
  role: "",
};

export default function UtilisateursPage() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const canManage = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE"]);
  const options = assignableRoles(profile?.role);

  async function loadProfiles() {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("nom_utilisateur");
    setProfiles((data as Profile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.nom_utilisateur.trim() || !form.email.trim() || !form.password || !form.role) {
      setError("Tous les champs sont obligatoires.");
      return;
    }
    if (!profile) return;

    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email: form.email.trim(),
        password: form.password,
        nom_utilisateur: form.nom_utilisateur.trim(),
        role: form.role,
        organization_id: profile.organization_id,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(`Erreur : ${body.error ?? res.statusText}`);
      return;
    }

    setForm(emptyForm);
    loadProfiles();
  }

  async function updateRole(p: Profile, role: string) {
    setRowError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", p.id);
    if (updateError) {
      setRowError(`Erreur : ${updateError.message}`);
      return;
    }
    loadProfiles();
  }

  async function toggleActif(p: Profile) {
    setRowError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ actif: !p.actif })
      .eq("id", p.id);
    if (updateError) {
      setRowError(`Erreur : ${updateError.message}`);
      return;
    }
    loadProfiles();
  }

  if (!canManage) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">Utilisateurs</h1>
        <p className="text-sm text-text-secondary">
          Ton rôle ({profile?.role}) ne permet pas d&apos;accéder à la gestion
          des utilisateurs — réservée à ADMIN_N1 et ADMIN_SITE.
        </p>
      </div>
    );
  }

  // Les comptes ADMIN_N1 restent invisibles pour un ADMIN_SITE, comme dans FIMS
  // Excel (MasquerLignesAdmin) — un ADMIN_SITE ne gère que sa propre organisation.
  const visibleProfiles = profiles.filter(
    (p) => profile?.role === "ADMIN_N1" || p.role !== "ADMIN_N1"
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">Utilisateurs</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 max-w-2xl rounded-xl border border-border-subtle bg-bg-card p-6"
      >
        <p className="mb-4 text-sm font-medium text-text-secondary">
          Créer un utilisateur
        </p>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Nom complet"
            required
            value={form.nom_utilisateur}
            onChange={(e) => setForm({ ...form, nom_utilisateur: e.target.value })}
          />
          <FormField
            label="Email"
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <FormField
            label="Mot de passe temporaire"
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <FormField label="Rôle" required>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className={fieldControlClass}
            >
              <option value="">—</option>
              {options.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

        <PrimaryButton type="submit" disabled={saving}>
          {saving ? "Création..." : "Créer"}
        </PrimaryButton>
      </form>

      {rowError && <p className="mb-4 text-sm text-accent-red">{rowError}</p>}

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-full text-sm">
          <MiniTableHeader
            columns={["Nom", "Rôle", "Statut"]}
            align={["left", "left", "left"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-text-secondary">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && visibleProfiles.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-text-secondary">
                  Aucun utilisateur.
                </td>
              </tr>
            )}
            {visibleProfiles.map((p) => {
              // On ne peut jamais modifier son propre rôle/statut ici (bloqué
              // aussi côté base par un trigger) — évite un contrôle qui échouerait.
              const editable =
                p.id !== profile?.id &&
                options.includes(p.role as (typeof options)[number]);
              return (
                <tr key={p.id} className="text-text-primary">
                  <td className="px-3 py-2">{p.nom_utilisateur}</td>
                  <td className="px-3 py-2">
                    {editable ? (
                      <select
                        value={p.role}
                        onChange={(e) => updateRole(p, e.target.value)}
                        className={fieldControlClass}
                      >
                        {options.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-text-secondary">{p.role}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editable ? (
                      <button
                        onClick={() => toggleActif(p)}
                        className={
                          p.actif
                            ? "rounded-full bg-bg-card-teal px-2 py-0.5 text-xs text-accent-teal"
                            : "rounded-full bg-accent-red/10 px-2 py-0.5 text-xs text-accent-red"
                        }
                      >
                        {p.actif ? "Actif" : "Désactivé"}
                      </button>
                    ) : (
                      <span className="text-text-secondary">
                        {p.actif ? "Actif" : "Désactivé"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
