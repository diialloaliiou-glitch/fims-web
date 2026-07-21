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

  const [sourceProjectId, setSourceProjectId] = useState<Record<string, string>>({});
  const [cloneTables, setCloneTables] = useState<Record<string, Set<string>>>({});
  const [cloning, setCloning] = useState<string | null>(null);
  const [cloneMessage, setCloneMessage] = useState<string | null>(null);

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

  async function toggleTemplate(p: Project) {
    await supabase.from("projects").update({ is_template: !p.is_template }).eq("id", p.id);
    loadAll();
  }

  function toggleCloneTable(projectId: string, table: string) {
    setCloneTables((prev) => {
      const current = new Set(prev[projectId] ?? []);
      if (current.has(table)) current.delete(table);
      else current.add(table);
      return { ...prev, [projectId]: current };
    });
  }

  // Copie plan comptable / tiers / personnel depuis un projet source vers
  // un projet cible — pour amorcer un nouveau projet (meme bailleur : clone
  // un projet existant ; nouveau bailleur : clone le projet marque "modele").
  async function handleCloner(targetProjectId: string) {
    setCloneMessage(null);
    const source = sourceProjectId[targetProjectId];
    const tables = cloneTables[targetProjectId] ?? new Set<string>();
    if (!source || tables.size === 0 || !profile) {
      setCloneMessage("Choisis un projet source et au moins une table à cloner.");
      return;
    }

    setCloning(targetProjectId);

    const tasks: Promise<{ table: string; count: number; error: string | null }>[] = [];

    if (tables.has("chart_of_accounts")) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("chart_of_accounts")
            .select("compte, sous_compte, compte_tiers, ccompte, s_compte, libelle, type_compte")
            .eq("project_id", source);
          const rows = (data ?? []).map((r) => ({
            ...r,
            organization_id: profile.organization_id,
            project_id: targetProjectId,
          }));
          const { error } = rows.length
            ? await supabase.from("chart_of_accounts").insert(rows)
            : { error: null };
          return { table: "Plan comptable", count: rows.length, error: error?.message ?? null };
        })()
      );
    }

    if (tables.has("third_parties")) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("third_parties")
            .select("compte_classe_4, nom_tiers, type, contact, statut, zone_id")
            .eq("project_id", source);
          const rows = (data ?? []).map((r) => ({
            ...r,
            organization_id: profile.organization_id,
            project_id: targetProjectId,
          }));
          const { error } = rows.length
            ? await supabase.from("third_parties").insert(rows)
            : { error: null };
          return { table: "Tiers", count: rows.length, error: error?.message ?? null };
        })()
      );
    }

    if (tables.has("personnel")) {
      tasks.push(
        (async () => {
          const { data } = await supabase
            .from("personnel")
            .select(
              "matricule, prenom_nom, poste, b_s_line, compte_classe_4, salaire_brut, inps_patronale, inps_ouvriere, its, tl_patronale, salaire_net, date_debut, date_fin, statut, zone_id"
            )
            .eq("project_id", source);
          const rows = (data ?? []).map((r) => ({
            ...r,
            organization_id: profile.organization_id,
            project_id: targetProjectId,
          }));
          const { error } = rows.length
            ? await supabase.from("personnel").insert(rows)
            : { error: null };
          return { table: "Personnel", count: rows.length, error: error?.message ?? null };
        })()
      );
    }

    const results = await Promise.all(tasks);
    setCloning(null);

    const erreurs = results.filter((r) => r.error);
    if (erreurs.length > 0) {
      setCloneMessage(
        `Erreur(s) : ${erreurs.map((r) => `${r.table} — ${r.error}`).join(" · ")}`
      );
      return;
    }

    setCloneMessage(
      `Copié : ${results.map((r) => `${r.table} (${r.count})`).join(", ")}.`
    );
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
      {cloneMessage && <p className="mb-4 text-sm text-accent-teal">{cloneMessage}</p>}

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-full text-sm">
          <MiniTableHeader
            columns={["Code", "Nom", "Statut", "Modèle", "Utilisateurs assignés"]}
            align={["left", "left", "left", "left", "left"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-text-secondary">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && projects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-text-secondary">
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
                        onClick={() => toggleTemplate(p)}
                        className={
                          p.is_template
                            ? "rounded-full bg-bg-card-teal px-2 py-0.5 text-xs text-accent-teal"
                            : "rounded-full border border-border-subtle px-2 py-0.5 text-xs text-text-secondary"
                        }
                      >
                        {p.is_template ? "★ Modèle" : "Définir modèle"}
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
                      <td colSpan={5} className="bg-bg-card-muted px-3 py-3">
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

                        <div className="mt-4 border-t border-border-subtle pt-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Amorcer les données (copier depuis un autre projet)
                          </p>
                          <div className="flex flex-wrap items-end gap-3">
                            <select
                              value={sourceProjectId[p.id] ?? ""}
                              onChange={(e) =>
                                setSourceProjectId({ ...sourceProjectId, [p.id]: e.target.value })
                              }
                              className="rounded-md border border-border-subtle bg-bg-card px-2 py-1.5 text-sm text-text-primary"
                            >
                              <option value="">Choisir un projet source...</option>
                              {projects
                                .filter((autre) => autre.id !== p.id)
                                .map((autre) => (
                                  <option key={autre.id} value={autre.id}>
                                    {autre.is_template ? "★ " : ""}
                                    {autre.code_projet} — {autre.nom_projet}
                                  </option>
                                ))}
                            </select>
                            {[
                              { key: "chart_of_accounts", label: "Plan comptable" },
                              { key: "third_parties", label: "Tiers" },
                              { key: "personnel", label: "Personnel" },
                            ].map((t) => (
                              <label
                                key={t.key}
                                className="flex items-center gap-1.5 text-sm text-text-secondary"
                              >
                                <input
                                  type="checkbox"
                                  checked={(cloneTables[p.id] ?? new Set()).has(t.key)}
                                  onChange={() => toggleCloneTable(p.id, t.key)}
                                />
                                {t.label}
                              </label>
                            ))}
                            <button
                              onClick={() => handleCloner(p.id)}
                              disabled={cloning === p.id}
                              className="rounded-md bg-accent-teal px-4 py-1.5 text-sm font-medium text-on-accent-light hover:opacity-90 disabled:opacity-60"
                            >
                              {cloning === p.id ? "Copie..." : "Cloner"}
                            </button>
                          </div>
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
