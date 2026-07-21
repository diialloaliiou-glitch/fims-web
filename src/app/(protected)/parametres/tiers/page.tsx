"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { ChartOfAccount, ThirdParty, Zone } from "@/lib/types";

// Liste exacte de la validation de liste deroulante "Type" (colonne D de la
// feuille SUIVI DES TIERS du fichier BASE Excel).
const TYPES_TIERS = ["Client", "Fournisseur", "Prestataire", "Bailleur", "Employé", "Autre"];

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
  const { t } = useLanguage();
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

  function startEdit(tiersItem: ThirdParty) {
    setEditingId(tiersItem.id);
    setForm({
      compte_classe_4: tiersItem.compte_classe_4 ?? "",
      nom_tiers: tiersItem.nom_tiers,
      type: tiersItem.type ?? TYPES_TIERS[0],
      contact: tiersItem.contact ?? "",
      statut: tiersItem.statut ?? "Actif",
      zone_id: tiersItem.zone_id != null ? String(tiersItem.zone_id) : "",
    });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.nom_tiers.trim()) {
      setError(t.tiersPage.erreurNomObligatoire);
      return;
    }
    if (!form.compte_classe_4.trim()) {
      setError(t.tiersPage.erreurCompteObligatoire);
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

  async function toggleStatut(tiersItem: ThirdParty) {
    const nextStatut = tiersItem.statut === "Actif" ? "Inactif" : "Actif";
    await supabase
      .from("third_parties")
      .update({ statut: nextStatut })
      .eq("id", tiersItem.id);
    loadTiers();
  }

  const filtered = tiers.filter((tiersItem) => {
    if (!filter.trim()) return true;
    return tiersItem.nom_tiers.toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">{t.tiersPage.titre}</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 max-w-3xl rounded-xl border border-border-subtle bg-bg-card p-6"
      >
        <p className="mb-4 text-sm font-medium text-text-secondary">
          {editingId ? `${t.tiersPage.modifierTiers}${editingId}` : t.tiersPage.ajouterUnTiers}
        </p>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <FormField
              label={t.tiersPage.nomDuTiers}
              required
              value={form.nom_tiers}
              onChange={(e) => setForm({ ...form, nom_tiers: e.target.value })}
            />
          </div>
          <FormField label={t.tiersPage.type}>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className={fieldControlClass}
            >
              {TYPES_TIERS.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
          </FormField>
          <div>
            <FormField
              label={t.tiersPage.compteClasse4}
              required
              list="comptes-tiers-list"
              value={form.compte_classe_4}
              onChange={(e) =>
                setForm({ ...form, compte_classe_4: e.target.value })
              }
            />
            <datalist id="comptes-tiers-list">
              {comptesTiers.map((c) => (
                <option key={c.id} value={c.ccompte}>
                  {c.libelle}
                </option>
              ))}
            </datalist>
          </div>
          <FormField
            label={t.tiersPage.contact}
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
          />
          <FormField label={t.common.zone}>
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
        </div>

        {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

        <div className="flex gap-3">
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? t.common.enregistrement : editingId ? t.common.mettreAJour : t.common.ajouter}
          </PrimaryButton>
          {editingId && (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-md border border-border-subtle px-5 py-2 text-text-secondary hover:bg-bg-card"
            >
              {t.common.annuler}
            </button>
          )}
        </div>
      </form>

      <div className="mb-4 max-w-sm">
        <FormField
          label={t.tiersPage.filtrer}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t.tiersPage.filtrerPlaceholder}
        />
      </div>

      <div className="max-h-[65vh] overflow-auto rounded-xl border border-border-subtle print:max-h-none print:overflow-visible">
        <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
          <MiniTableHeader
            columns={[t.tiersPage.colNom, t.tiersPage.colType, t.tiersPage.colContact, t.common.statut, t.common.action]}
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
            {!loading &&
              filtered.map((tiersItem) => (
                <tr key={tiersItem.id} className="text-text-primary">
                  <td className="px-3 py-2">{tiersItem.nom_tiers}</td>
                  <td className="px-3 py-2 text-text-secondary">{tiersItem.type}</td>
                  <td className="px-3 py-2 text-text-secondary">{tiersItem.contact}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleStatut(tiersItem)}
                      className={
                        tiersItem.statut === "Actif"
                          ? "rounded-full bg-bg-card-teal px-2 py-0.5 text-xs text-accent-teal"
                          : "rounded-full bg-bg-card px-2 py-0.5 text-xs text-text-secondary"
                      }
                    >
                      {tiersItem.statut ?? "Actif"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => startEdit(tiersItem)}
                      className="text-accent-blue hover:underline"
                    >
                      {t.common.modifier}
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
