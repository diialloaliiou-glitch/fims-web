"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { hasRole } from "@/lib/roles";
import type { PeriodClosure } from "@/lib/types";

function moisCourantDefaut() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
}

function anneeCouranteDefaut() {
  return String(new Date().getFullYear());
}

export default function CloturePage() {
  const { profile, project } = useAuth();
  const { t } = useLanguage();
  const [closures, setClosures] = useState<PeriodClosure[]>([]);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<"MENSUELLE" | "ANNUELLE">("MENSUELLE");
  const [periode, setPeriode] = useState(moisCourantDefaut());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [reopeningId, setReopeningId] = useState<number | null>(null);
  const [motif, setMotif] = useState("");
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);

  const canCloturer = hasRole(profile?.role, ["ADMIN_SITE", "RAF"]);

  async function loadClosures() {
    if (!project) return;
    setLoading(true);
    const { data } = await supabase
      .from("period_closures")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    setClosures((data as PeriodClosure[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadClosures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  function changeType(newType: "MENSUELLE" | "ANNUELLE") {
    setType(newType);
    setPeriode(newType === "MENSUELLE" ? moisCourantDefaut() : anneeCouranteDefaut());
  }

  async function handleCloturer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const format = type === "MENSUELLE" ? /^\d{2}\/\d{4}$/ : /^\d{4}$/;
    if (!format.test(periode.trim())) {
      setError(
        type === "MENSUELLE"
          ? t.cloture.erreurFormatMensuelle
          : t.cloture.erreurFormatAnnuelle
      );
      return;
    }
    if (!project || !profile) return;

    const dejaFermee = closures.find(
      (c) => c.type === type && c.periode === periode.trim() && c.statut === "CLOTUREE"
    );
    if (dejaFermee) {
      setError(t.cloture.erreurDejaCloturee);
      return;
    }

    setSaving(true);

    const { error: insertError } = await supabase.from("period_closures").insert({
      organization_id: profile.organization_id,
      project_id: project.id,
      type,
      periode: periode.trim(),
      date_cloture: new Date().toISOString(),
      cloture_par: profile.nom_utilisateur,
      statut: "CLOTUREE",
    });

    setSaving(false);

    if (insertError) {
      setError(`Erreur : ${insertError.message}`);
      return;
    }

    loadClosures();
  }

  function openReopen(id: number) {
    setReopeningId(id);
    setMotif("");
    setReopenError(null);
  }

  async function confirmReopen() {
    setReopenError(null);
    if (!motif.trim()) {
      setReopenError(t.cloture.erreurMotifObligatoire);
      return;
    }
    if (!profile || reopeningId === null) return;

    setReopening(true);

    const { error: updateError } = await supabase
      .from("period_closures")
      .update({
        statut: "ROUVERTE",
        date_reouverture: new Date().toISOString(),
        reouverture_par: profile.nom_utilisateur,
        motif_reouverture: motif.trim(),
      })
      .eq("id", reopeningId);

    setReopening(false);

    if (updateError) {
      setReopenError(`Erreur : ${updateError.message}`);
      return;
    }

    setReopeningId(null);
    loadClosures();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {t.cloture.titre}
      </h1>

      {canCloturer ? (
        <form
          onSubmit={handleCloturer}
          className="mb-6 max-w-lg rounded-xl border border-border-subtle bg-bg-card p-6"
        >
          <p className="mb-4 text-sm font-medium text-text-secondary">
            {t.cloture.cloturerUnePeriode}
          </p>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t.cloture.type}>
              <select
                value={type}
                onChange={(e) =>
                  changeType(e.target.value as "MENSUELLE" | "ANNUELLE")
                }
                className={fieldControlClass}
              >
                <option value="MENSUELLE">{t.cloture.mensuelle}</option>
                <option value="ANNUELLE">{t.cloture.annuelle}</option>
              </select>
            </FormField>
            <FormField
              label={type === "MENSUELLE" ? t.cloture.moisFormat : t.cloture.anneeFormat}
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
            />
          </div>

          {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

          <PrimaryButton type="submit" disabled={saving}>
            {saving ? t.cloture.cloture : t.cloture.cloturer}
          </PrimaryButton>
        </form>
      ) : (
        <p className="mb-6 text-sm text-text-secondary">
          {t.cloture.permissionInfo.replace("{role}", profile?.role ?? "")}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-full text-sm">
          <MiniTableHeader
            columns={[t.cloture.colType, t.cloture.colPeriode, t.common.statut, t.cloture.colClôturePar, t.cloture.colDateCloture, t.cloture.colMotifReouverture, t.common.action]}
            align={["left", "left", "left", "left", "left", "left", "right"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-text-secondary">
                  {t.common.chargement}
                </td>
              </tr>
            )}
            {!loading && closures.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-text-secondary">
                  {t.cloture.aucuneCloture}
                </td>
              </tr>
            )}
            {closures.map((c) => (
              <tr key={c.id} className="text-text-primary">
                <td className="px-3 py-2">{c.type}</td>
                <td className="px-3 py-2">{c.periode}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      c.statut === "CLOTUREE"
                        ? "rounded-full bg-accent-red/10 px-2 py-0.5 text-xs text-accent-red"
                        : "rounded-full bg-bg-card-teal px-2 py-0.5 text-xs text-accent-teal"
                    }
                  >
                    {c.statut}
                  </span>
                </td>
                <td className="px-3 py-2 text-text-secondary">{c.cloture_par}</td>
                <td className="px-3 py-2 text-text-secondary">
                  {new Date(c.date_cloture).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-text-secondary">
                  {c.motif_reouverture}
                </td>
                <td className="px-3 py-2 text-right">
                  {c.statut === "CLOTUREE" && canCloturer && (
                    <button
                      onClick={() => openReopen(c.id)}
                      className="text-accent-blue hover:underline"
                    >
                      {t.cloture.rouvrir}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reopeningId !== null && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-bg-card p-6">
            <p className="mb-4 font-medium text-text-primary">
              {t.cloture.rouvrirLaPeriode}{reopeningId}
            </p>
            <div className="mb-3">
              <FormField
                label={t.cloture.motifReouverture}
                required
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
              />
            </div>
            {reopenError && (
              <p className="mb-3 text-sm text-accent-red">{reopenError}</p>
            )}
            <div className="flex gap-3">
              <PrimaryButton onClick={confirmReopen} disabled={reopening}>
                {reopening ? "..." : t.common.confirmer}
              </PrimaryButton>
              <button
                onClick={() => setReopeningId(null)}
                className="rounded-md border border-border-subtle px-4 py-2 text-text-secondary hover:bg-bg-card"
              >
                {t.common.annuler}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
