"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { hasRole } from "@/lib/roles";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Country, Zone } from "@/lib/types";

const emptyForm = { code: "", country_id: "" };

export default function ZonesPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [zones, setZones] = useState<Zone[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [nouveauPaysMode, setNouveauPaysMode] = useState(false);
  const [nouveauPaysCode, setNouveauPaysCode] = useState("");
  const [nouveauPaysNom, setNouveauPaysNom] = useState("");
  const [savingPays, setSavingPays] = useState(false);
  const [erreurPays, setErreurPays] = useState<string | null>(null);

  const canManage = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"]);

  async function loadZones() {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from("zones")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("code");
    setZones((data as Zone[]) ?? []);
    setLoading(false);
  }

  async function loadCountries() {
    const { data } = await supabase.from("countries").select("*").order("nom");
    setCountries((data as Country[]) ?? []);
  }

  useEffect(() => {
    loadZones();
    loadCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleAjouterPays() {
    setErreurPays(null);
    if (!nouveauPaysCode.trim() || !nouveauPaysNom.trim()) {
      setErreurPays("Le code et le nom du pays sont obligatoires.");
      return;
    }

    setSavingPays(true);
    const { data, error: insertError } = await supabase
      .from("countries")
      .insert({ code: nouveauPaysCode.trim().toUpperCase(), nom: nouveauPaysNom.trim() })
      .select("*")
      .single();
    setSavingPays(false);

    if (insertError) {
      setErreurPays(`Erreur : ${insertError.message}`);
      return;
    }

    await loadCountries();
    setForm((f) => ({ ...f, country_id: String((data as Country).id) }));
    setNouveauPaysCode("");
    setNouveauPaysNom("");
    setNouveauPaysMode(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.code.trim()) {
      setError("Le code de la zone est obligatoire.");
      return;
    }
    if (!form.country_id) {
      setError("Le pays est obligatoire.");
      return;
    }
    if (!profile) return;

    setSaving(true);

    const { error: insertError } = await supabase.from("zones").insert({
      organization_id: profile.organization_id,
      code: form.code.trim(),
      country_id: Number(form.country_id),
    });

    setSaving(false);

    if (insertError) {
      setError(`Erreur : ${insertError.message}`);
      return;
    }

    setForm(emptyForm);
    loadZones();
  }

  async function handleDelete(z: Zone) {
    setDeleteError(null);
    setDeletingId(z.id);

    const [tiersRes, personnelRes, journalRes] = await Promise.all([
      supabase.from("third_parties").select("id", { count: "exact", head: true }).eq("zone_id", z.id),
      supabase.from("personnel").select("id", { count: "exact", head: true }).eq("zone_id", z.id),
      supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("zone_id", z.id),
    ]);

    const total = (tiersRes.count ?? 0) + (personnelRes.count ?? 0) + (journalRes.count ?? 0);
    if (total > 0) {
      setDeletingId(null);
      setDeleteError(
        `Impossible de supprimer : ${total} enregistrement(s) (tiers, personnel ou écritures) utilisent encore cette zone.`
      );
      return;
    }

    const { error: deleteErr } = await supabase.from("zones").delete().eq("id", z.id);

    setDeletingId(null);

    if (deleteErr) {
      setDeleteError(`Erreur : ${deleteErr.message}`);
      return;
    }

    loadZones();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">Zones et pays d&apos;intervention</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Zones communes à tous les projets de l&apos;organisation, chacune associée à un pays.
      </p>

      {canManage && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 max-w-xl rounded-xl border border-border-subtle bg-bg-card p-6"
        >
          <p className="mb-4 text-sm font-medium text-text-secondary">Ajouter une zone</p>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Code de la zone"
              required
              placeholder="Ex: BAMAKO"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <div>
              <FormField label="Pays" required>
                <select
                  value={form.country_id}
                  onChange={(e) => setForm({ ...form, country_id: e.target.value })}
                  className={fieldControlClass}
                >
                  <option value="">—</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </FormField>
              {!nouveauPaysMode ? (
                <button
                  type="button"
                  onClick={() => setNouveauPaysMode(true)}
                  className="mt-1 text-xs text-accent-blue hover:underline"
                >
                  + Nouveau pays
                </button>
              ) : (
                <div className="mt-2 flex items-end gap-2">
                  <div className="w-20">
                    <FormField
                      label="Code"
                      placeholder="Ex: SN"
                      value={nouveauPaysCode}
                      onChange={(e) => setNouveauPaysCode(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <FormField
                      label="Nom du pays"
                      value={nouveauPaysNom}
                      onChange={(e) => setNouveauPaysNom(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAjouterPays}
                    disabled={savingPays}
                    className="rounded-md bg-accent-teal px-3 py-2 text-sm font-medium text-on-accent-light hover:opacity-90 disabled:opacity-60"
                  >
                    {savingPays ? "..." : "Ajouter"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNouveauPaysMode(false);
                      setNouveauPaysCode("");
                      setNouveauPaysNom("");
                      setErreurPays(null);
                    }}
                    className="rounded-md border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-bg-card"
                  >
                    Annuler
                  </button>
                </div>
              )}
              {erreurPays && <p className="mt-1 text-xs text-accent-red">{erreurPays}</p>}
            </div>
          </div>

          {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Enregistrement..." : "Créer"}
          </PrimaryButton>
        </form>
      )}

      {deleteError && <p className="mb-4 text-sm text-accent-red">{deleteError}</p>}

      <div className="max-h-[65vh] overflow-auto rounded-xl border border-border-subtle print:max-h-none print:overflow-visible">
        <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
          <MiniTableHeader columns={["Zone", "Pays", "Action"]} align={["left", "left", "right"]} />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-text-secondary">
                  {t.common.chargement}
                </td>
              </tr>
            )}
            {!loading && zones.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-text-secondary">
                  Aucune zone enregistrée.
                </td>
              </tr>
            )}
            {zones.map((z) => {
              const pays = countries.find((c) => c.id === z.country_id);
              return (
                <tr key={z.id} className="text-text-primary">
                  <td className="px-3 py-2">{z.code}</td>
                  <td className="px-3 py-2 text-text-secondary">{pays?.nom ?? ""}</td>
                  <td className="px-3 py-2 text-right">
                    {canManage && (
                      <button
                        onClick={() => handleDelete(z)}
                        disabled={deletingId === z.id}
                        className="text-accent-red hover:underline disabled:opacity-60"
                      >
                        {deletingId === z.id ? "..." : t.common.supprimer}
                      </button>
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
