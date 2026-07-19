"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { ChartOfAccount, ThirdParty, Zone } from "@/lib/types";

const TYPES_TIERS = ["Fournisseur", "Prestataire", "Bailleur", "Personnel", "Autre"];

const emptyForm = {
  compte_classe_4: "",
  nom_tiers: "",
  type: TYPES_TIERS[0],
  contact: "",
  statut: "Actif",
  zone_id: "",
};

export default function TiersPage() {
  const { profile, project } = useAuth();
  const [tiers, setTiers] = useState<ThirdParty[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [comptesTiers, setComptesTiers] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function loadTiers() {
    if (!project) return;
    setLoading(true);
    const { data } = await supabase
      .from("third_parties")
      .select("*")
      .eq("project_id", project.id)
      .order("nom_tiers");
    setTiers((data as ThirdParty[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadTiers();
    if (project) {
      supabase
        .from("zones")
        .select("*")
        .eq("organization_id", project.organization_id)
        .order("code")
        .then(({ data }) => setZones((data as Zone[]) ?? []));

      supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("project_id", project.id)
        .eq("compte_tiers", true)
        .order("ccompte")
        .then(({ data }) => setComptesTiers((data as ChartOfAccount[]) ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function startEdit(t: ThirdParty) {
    setEditingId(t.id);
    setForm({
      compte_classe_4: t.compte_classe_4 ?? "",
      nom_tiers: t.nom_tiers,
      type: t.type ?? TYPES_TIERS[0],
      contact: t.contact ?? "",
      statut: t.statut ?? "Actif",
      zone_id: t.zone_id != null ? String(t.zone_id) : "",
    });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.nom_tiers.trim()) {
      setError("Le nom du tiers est obligatoire.");
      return;
    }
    if (!form.compte_classe_4.trim()) {
      setError("Le compte classe 4 est obligatoire.");
      return;
    }
    if (!project || !profile) return;

    setSaving(true);

    const payload = {
      compte_classe_4: form.compte_classe_4.trim(),
      nom_tiers: form.nom_tiers.trim(),
      type: form.type || null,
      contact: form.contact.trim() || null,
      statut: form.statut,
      zone_id: form.zone_id ? parseInt(form.zone_id, 10) : null,
    };

    const result = editingId
      ? await supabase.from("third_parties").update(payload).eq("id", editingId)
      : await supabase.from("third_parties").insert({
          ...payload,
          organization_id: profile.organization_id,
          project_id: project.id,
        });

    setSaving(false);

    if (result.error) {
      setError(`Erreur : ${result.error.message}`);
      return;
    }

    startCreate();
    loadTiers();
  }

  async function toggleStatut(t: ThirdParty) {
    const nextStatut = t.statut === "Actif" ? "Inactif" : "Actif";
    await supabase
      .from("third_parties")
      .update({ statut: nextStatut })
      .eq("id", t.id);
    loadTiers();
  }

  const filtered = tiers.filter((t) => {
    if (!filter.trim()) return true;
    return t.nom_tiers.toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-fg-primary">Tiers</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 max-w-3xl rounded-xl border border-border-default bg-surface-1 p-6"
      >
        <p className="mb-4 text-sm font-medium text-fg-secondary">
          {editingId ? `Modifier le tiers #${editingId}` : "Ajouter un tiers"}
        </p>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-fg-secondary">
              Nom du tiers *
            </label>
            <input
              type="text"
              required
              value={form.nom_tiers}
              onChange={(e) => setForm({ ...form, nom_tiers: e.target.value })}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-fg-secondary">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            >
              {TYPES_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-fg-secondary">
              Compte classe 4 *
            </label>
            <input
              type="text"
              required
              list="comptes-tiers-list"
              value={form.compte_classe_4}
              onChange={(e) =>
                setForm({ ...form, compte_classe_4: e.target.value })
              }
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
            <datalist id="comptes-tiers-list">
              {comptesTiers.map((c) => (
                <option key={c.id} value={c.ccompte}>
                  {c.libelle}
                </option>
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-sm text-fg-secondary">Contact</label>
            <input
              type="text"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-fg-secondary">Zone</label>
            <select
              value={form.zone_id}
              onChange={(e) => setForm({ ...form, zone_id: e.target.value })}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            >
              <option value="">—</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent-green px-5 py-2 font-medium text-on-accent hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Ajouter"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-md border border-border-default px-5 py-2 text-fg-secondary hover:bg-surface-2"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrer par nom..."
        className="mb-4 w-full max-w-sm rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
      />

      <div className="overflow-x-auto rounded-xl border border-border-default">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-2 text-fg-secondary">
            <tr>
              <th className="px-3 py-2 text-left">Nom</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Contact</th>
              <th className="px-3 py-2 text-left">Statut</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default bg-surface-1/60">
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-fg-muted">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((t) => (
                <tr key={t.id} className="text-fg-primary">
                  <td className="px-3 py-2">{t.nom_tiers}</td>
                  <td className="px-3 py-2 text-fg-muted">{t.type}</td>
                  <td className="px-3 py-2 text-fg-muted">{t.contact}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleStatut(t)}
                      className={
                        t.statut === "Actif"
                          ? "rounded-full bg-accent-green-bg px-2 py-0.5 text-xs text-accent-green-fg"
                          : "rounded-full bg-surface-2 px-2 py-0.5 text-xs text-fg-muted"
                      }
                    >
                      {t.statut ?? "Actif"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => startEdit(t)}
                      className="text-accent-blue hover:underline"
                    >
                      Modifier
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
