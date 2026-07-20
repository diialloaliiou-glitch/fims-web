"use client";

import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { hasRole } from "@/lib/roles";
import { FormField } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Profile, Project } from "@/lib/types";

const emptyForm = {
  nom_projet: "",
  code_projet: "",
};

export default function ProjetsPage() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [links, setLinks] = useState<{ profile_id: string; project_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const canManage = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"]);

  async function loadAll() {
    if (!profile) return;
    setLoading(true);

    const [{ data: projectsData }, { data: profilesData }, { data: linksData }] =
      await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .eq("organization_id", profile.organization_id)
          .order("nom_projet"),
        supabase
          .from("profiles")
          .select("*")
          .eq("organization_id", profile.organization_id)
          .order("nom_utilisateur"),
        supabase.from("profile_projects").select("profile_id, project_id"),
      ]);

    setProjects((projectsData as Project[]) ?? []);
    setProfiles((profilesData as Profile[]) ?? []);
    setLinks(linksData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.nom_projet.trim() || !form.code_projet.trim()) {
      setError("Nom et code du projet sont obligatoires.");
      return;
    }
    if (!profile) return;

    setSaving(true);

    const { error: insertError } = await supabase.from("projects").insert({
      organization_id: profile.organization_id,
      nom_projet: form.nom_projet.trim(),
      code_projet: form.code_projet.trim(),
      actif: true,
    });

    setSaving(false);

    if (insertError) {
      setError(`Erreur : ${insertError.message}`);
      return;
    }

    setForm(emptyForm);
    loadAll();
  }

  async function toggleActif(p: Project) {
    await supabase.from("projects").update({ actif: !p.actif }).eq("id", p.id);
    loadAll();
  }

  async function toggleAssignment(projectId: string, profileId: string, assigned: boolean) {
    setLinkError(null);
    const result = assigned
      ? await supabase
          .from("profile_projects")
          .delete()
          .eq("project_id", projectId)
          .eq("profile_id", profileId)
      : await supabase
          .from("profile_projects")
          .insert({ project_id: projectId, profile_id: profileId });

    if (result.error) {
      setLinkError(`Erreur : ${result.error.message}`);
      return;
    }
    loadAll();
  }

  if (!canManage) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">Projets</h1>
        <p className="text-sm text-text-secondary">
          Ton rôle ({profile?.role}) ne permet pas d&apos;accéder à la gestion
          des projets — réservée à ADMIN_N1, ADMIN_SITE et RAF.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">Projets</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 max-w-xl rounded-xl border border-border-subtle bg-bg-card p-6"
      >
        <p className="mb-4 text-sm font-medium text-text-secondary">
          Créer un projet
        </p>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Nom du projet"
            required
            value={form.nom_projet}
            onChange={(e) => setForm({ ...form, nom_projet: e.target.value })}
          />
          <FormField
            label="Code projet"
            required
            value={form.code_projet}
            onChange={(e) => setForm({ ...form, code_projet: e.target.value })}
          />
        </div>

        {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

        <PrimaryButton type="submit" disabled={saving}>
          {saving ? "Création..." : "Créer"}
        </PrimaryButton>
      </form>

      {linkError && <p className="mb-4 text-sm text-accent-red">{linkError}</p>}

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-full text-sm">
          <MiniTableHeader
            columns={["Code", "Nom", "Statut", "Utilisateurs assignés"]}
            align={["left", "left", "left", "left"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-text-secondary">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && projects.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-text-secondary">
                  Aucun projet.
                </td>
              </tr>
            )}
            {projects.map((p) => {
              const assignedIds = new Set(
                links.filter((l) => l.project_id === p.id).map((l) => l.profile_id)
              );
              const isExpanded = expandedId === p.id;
              return (
                <Fragment key={p.id}>
                  <tr className="text-text-primary">
                    <td className="px-3 py-2">{p.code_projet}</td>
                    <td className="px-3 py-2">{p.nom_projet}</td>
                    <td className="px-3 py-2">
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
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="text-accent-blue hover:underline"
                      >
                        {assignedIds.size} utilisateur(s) — {isExpanded ? "masquer" : "gérer"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={4} className="bg-bg-card-muted px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {profiles.map((prof) => {
                            const assigned = assignedIds.has(prof.id);
                            return (
                              <button
                                key={prof.id}
                                onClick={() => toggleAssignment(p.id, prof.id, assigned)}
                                className={
                                  assigned
                                    ? "rounded-full bg-accent-blue-solid px-3 py-1 text-xs text-on-accent-dark"
                                    : "rounded-full border border-border-subtle px-3 py-1 text-xs text-text-secondary hover:border-accent-teal"
                                }
                              >
                                {prof.nom_utilisateur}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
