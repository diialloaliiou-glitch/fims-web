"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { ChartOfAccount, Personnel, Zone } from "@/lib/types";

const emptyForm = {
  matricule: "",
  prenom_nom: "",
  poste: "",
  b_s_line: "",
  compte_classe_4: "",
  salaire_brut: "",
  inps_patronale: "",
  inps_ouvriere: "",
  its: "",
  tl_patronale: "",
  date_debut: "",
  date_fin: "",
  zone_id: "",
};

function calculerSalaireNet(brut: string, inpsOuvriere: string, its: string) {
  const b = parseFloat(brut) || 0;
  const o = parseFloat(inpsOuvriere) || 0;
  const i = parseFloat(its) || 0;
  return b - o - i;
}

export default function PersonnelPage() {
  const { profile, project } = useAuth();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [comptes, setComptes] = useState<ChartOfAccount[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function loadPersonnel() {
    if (!profile || !project) return;
    setLoading(true);
    const { data } = await supabase
      .from("personnel")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("project_id", project.id)
      .order("matricule");
    setPersonnel((data as Personnel[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadPersonnel();
    if (project) {
      supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("project_id", project.id)
        .eq("compte_tiers", true)
        .order("ccompte")
        .then(({ data }) => setComptes((data as ChartOfAccount[]) ?? []));

      supabase
        .from("zones")
        .select("*")
        .eq("organization_id", project.organization_id)
        .order("code")
        .then(({ data }) => setZones((data as Zone[]) ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, project]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function startEdit(p: Personnel) {
    setEditingId(p.id);
    setForm({
      matricule: p.matricule,
      prenom_nom: p.prenom_nom,
      poste: p.poste ?? "",
      b_s_line: p.b_s_line ?? "",
      compte_classe_4: p.compte_classe_4 ?? "",
      salaire_brut: String(p.salaire_brut),
      inps_patronale: p.inps_patronale != null ? String(p.inps_patronale) : "",
      inps_ouvriere: p.inps_ouvriere != null ? String(p.inps_ouvriere) : "",
      its: p.its != null ? String(p.its) : "",
      tl_patronale: p.tl_patronale != null ? String(p.tl_patronale) : "",
      date_debut: p.date_debut ?? "",
      date_fin: p.date_fin ?? "",
      zone_id: p.zone_id != null ? String(p.zone_id) : "",
    });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.matricule.trim() || !form.prenom_nom.trim()) {
      setError("Matricule et nom sont obligatoires.");
      return;
    }
    if (!form.salaire_brut || parseFloat(form.salaire_brut) <= 0) {
      setError("Le salaire brut doit être supérieur à zéro.");
      return;
    }
    if (!profile || !project) return;

    setSaving(true);

    const salaireNet = calculerSalaireNet(
      form.salaire_brut,
      form.inps_ouvriere,
      form.its
    );

    const payload = {
      matricule: form.matricule.trim(),
      prenom_nom: form.prenom_nom.trim(),
      poste: form.poste.trim() || null,
      b_s_line: form.b_s_line.trim() || null,
      compte_classe_4: form.compte_classe_4.trim() || null,
      salaire_brut: parseFloat(form.salaire_brut),
      inps_patronale: form.inps_patronale ? parseFloat(form.inps_patronale) : null,
      inps_ouvriere: form.inps_ouvriere ? parseFloat(form.inps_ouvriere) : null,
      its: form.its ? parseFloat(form.its) : null,
      tl_patronale: form.tl_patronale ? parseFloat(form.tl_patronale) : null,
      salaire_net: salaireNet,
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
      zone_id: form.zone_id ? parseInt(form.zone_id, 10) : null,
    };

    const result = editingId
      ? await supabase.from("personnel").update(payload).eq("id", editingId)
      : await supabase.from("personnel").insert({
          ...payload,
          organization_id: profile.organization_id,
          project_id: project.id,
          statut: "Actif",
        });

    setSaving(false);

    if (result.error) {
      setError(`Erreur : ${result.error.message}`);
      return;
    }

    startCreate();
    loadPersonnel();
  }

  async function toggleStatut(p: Personnel) {
    const nextStatut = p.statut === "Actif" ? "Inactif" : "Actif";
    await supabase.from("personnel").update({ statut: nextStatut }).eq("id", p.id);
    loadPersonnel();
  }

  const salaireNetPreview = calculerSalaireNet(
    form.salaire_brut,
    form.inps_ouvriere,
    form.its
  );

  const filtered = personnel.filter((p) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      p.prenom_nom.toLowerCase().includes(q) ||
      p.matricule.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        Fiche Personnel
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 max-w-3xl rounded-xl border border-border-subtle bg-bg-card p-6"
      >
        <p className="mb-4 text-sm font-medium text-text-secondary">
          {editingId ? `Modifier #${editingId}` : "Ajouter un membre du personnel"}
        </p>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            label="Matricule"
            required
            value={form.matricule}
            onChange={(e) => setForm({ ...form, matricule: e.target.value })}
          />
          <div className="sm:col-span-2">
            <FormField
              label="Nom complet"
              required
              value={form.prenom_nom}
              onChange={(e) => setForm({ ...form, prenom_nom: e.target.value })}
            />
          </div>
          <FormField
            label="Poste"
            value={form.poste}
            onChange={(e) => setForm({ ...form, poste: e.target.value })}
          />
          <FormField
            label="B-S-Line (ligne budgétaire)"
            value={form.b_s_line}
            onChange={(e) => setForm({ ...form, b_s_line: e.target.value })}
          />
          <div>
            <FormField
              label="Compte classe 4"
              list="comptes-list"
              value={form.compte_classe_4}
              onChange={(e) =>
                setForm({ ...form, compte_classe_4: e.target.value })
              }
            />
            <datalist id="comptes-list">
              {comptes.map((c) => (
                <option key={c.id} value={c.ccompte}>
                  {c.libelle}
                </option>
              ))}
            </datalist>
          </div>
          <FormField label="Zone">
            <select
              value={form.zone_id}
              onChange={(e) => setForm({ ...form, zone_id: e.target.value })}
              className={fieldControlClass}
            >
              <option value="">—</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Salaire brut"
            required
            type="number"
            step="0.01"
            value={form.salaire_brut}
            onChange={(e) => setForm({ ...form, salaire_brut: e.target.value })}
          />
          <FormField
            label="INPS ouvrière"
            type="number"
            step="0.01"
            value={form.inps_ouvriere}
            onChange={(e) => setForm({ ...form, inps_ouvriere: e.target.value })}
          />
          <FormField
            label="ITS"
            type="number"
            step="0.01"
            value={form.its}
            onChange={(e) => setForm({ ...form, its: e.target.value })}
          />
          <FormField
            label="INPS patronale"
            type="number"
            step="0.01"
            value={form.inps_patronale}
            onChange={(e) => setForm({ ...form, inps_patronale: e.target.value })}
          />
          <FormField
            label="TL patronale"
            type="number"
            step="0.01"
            value={form.tl_patronale}
            onChange={(e) => setForm({ ...form, tl_patronale: e.target.value })}
          />
          <FormField
            label="Salaire net (calculé)"
            disabled
            value={salaireNetPreview.toLocaleString("fr-FR")}
          />
          <FormField
            label="Date début"
            type="date"
            value={form.date_debut}
            onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
          />
          <FormField
            label="Date fin"
            type="date"
            value={form.date_fin}
            onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
          />
        </div>

        {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

        <div className="flex gap-3">
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Ajouter"}
          </PrimaryButton>
          {editingId && (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-md border border-border-subtle px-5 py-2 text-text-secondary hover:bg-bg-card"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <div className="mb-4 max-w-sm">
        <FormField
          label="Filtrer"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Nom ou matricule..."
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-full text-sm">
          <MiniTableHeader
            columns={["Matricule", "Nom", "Poste", "Salaire net", "Statut", "Action"]}
            align={["left", "left", "left", "right", "left", "right"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-text-secondary">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((p) => (
                <tr key={p.id} className="text-text-primary">
                  <td className="px-3 py-2">{p.matricule}</td>
                  <td className="px-3 py-2">{p.prenom_nom}</td>
                  <td className="px-3 py-2 text-text-secondary">{p.poste}</td>
                  <td className="px-3 py-2 text-right">
                    {p.salaire_net.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleStatut(p)}
                      className={
                        p.statut === "Actif"
                          ? "rounded-full bg-bg-card-teal px-2 py-0.5 text-xs text-accent-teal"
                          : "rounded-full bg-bg-card px-2 py-0.5 text-xs text-text-secondary"
                      }
                    >
                      {p.statut}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => startEdit(p)}
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
