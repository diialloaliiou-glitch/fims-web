"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { PeriodClosure } from "@/lib/types";

const CAN_CLOTURER_ROLES = ["ADMIN_N1", "RAF"];

function moisCourantDefaut() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
}

function anneeCouranteDefaut() {
  return String(new Date().getFullYear());
}

export default function CloturePage() {
  const { profile, project } = useAuth();
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

  const canCloturer = profile ? CAN_CLOTURER_ROLES.includes(profile.role) : false;

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

  function changeType(t: "MENSUELLE" | "ANNUELLE") {
    setType(t);
    setPeriode(t === "MENSUELLE" ? moisCourantDefaut() : anneeCouranteDefaut());
  }

  async function handleCloturer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const format = type === "MENSUELLE" ? /^\d{2}\/\d{4}$/ : /^\d{4}$/;
    if (!format.test(periode.trim())) {
      setError(
        type === "MENSUELLE"
          ? "Format attendu : MM/AAAA (ex: 07/2026)."
          : "Format attendu : AAAA (ex: 2026)."
      );
      return;
    }
    if (!project || !profile) return;

    const dejaFermee = closures.find(
      (c) => c.type === type && c.periode === periode.trim() && c.statut === "CLOTUREE"
    );
    if (dejaFermee) {
      setError("Cette période est déjà clôturée.");
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
      setReopenError("Indique le motif de la réouverture.");
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
      <h1 className="mb-6 text-2xl font-semibold text-fg-primary">
        Clôture de période
      </h1>

      {canCloturer ? (
        <form
          onSubmit={handleCloturer}
          className="mb-6 max-w-lg rounded-xl border border-border-default bg-surface-1 p-6"
        >
          <p className="mb-4 text-sm font-medium text-fg-secondary">
            Clôturer une période
          </p>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-fg-secondary">Type</label>
              <select
                value={type}
                onChange={(e) =>
                  changeType(e.target.value as "MENSUELLE" | "ANNUELLE")
                }
                className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
              >
                <option value="MENSUELLE">Mensuelle</option>
                <option value="ANNUELLE">Annuelle</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-fg-secondary">
                {type === "MENSUELLE" ? "Mois (MM/AAAA)" : "Année (AAAA)"}
              </label>
              <input
                type="text"
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
                className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
              />
            </div>
          </div>

          {error && <p className="mb-3 text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent-green px-5 py-2 font-medium text-on-accent hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Clôture..." : "Clôturer"}
          </button>
        </form>
      ) : (
        <p className="mb-6 text-sm text-fg-muted">
          Ton rôle ({profile?.role}) ne permet pas de clôturer ou rouvrir une
          période — seuls ADMIN_N1 et RAF le peuvent.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border-default">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-2 text-fg-secondary">
            <tr>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Période</th>
              <th className="px-3 py-2 text-left">Statut</th>
              <th className="px-3 py-2 text-left">Clôturé par</th>
              <th className="px-3 py-2 text-left">Date clôture</th>
              <th className="px-3 py-2 text-left">Motif réouverture</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default bg-surface-1/60">
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-fg-muted">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && closures.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-fg-muted">
                  Aucune clôture enregistrée pour ce projet.
                </td>
              </tr>
            )}
            {closures.map((c) => (
              <tr key={c.id} className="text-fg-primary">
                <td className="px-3 py-2">{c.type}</td>
                <td className="px-3 py-2">{c.periode}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      c.statut === "CLOTUREE"
                        ? "rounded-full bg-danger-bg px-2 py-0.5 text-xs text-danger"
                        : "rounded-full bg-accent-green-bg px-2 py-0.5 text-xs text-accent-green-fg"
                    }
                  >
                    {c.statut}
                  </span>
                </td>
                <td className="px-3 py-2 text-fg-muted">{c.cloture_par}</td>
                <td className="px-3 py-2 text-fg-muted">
                  {new Date(c.date_cloture).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-fg-muted">
                  {c.motif_reouverture}
                </td>
                <td className="px-3 py-2 text-right">
                  {c.statut === "CLOTUREE" && canCloturer && (
                    <button
                      onClick={() => openReopen(c.id)}
                      className="text-accent-blue hover:underline"
                    >
                      Rouvrir
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
          <div className="w-full max-w-sm rounded-xl border border-border-default bg-surface-1 p-6">
            <p className="mb-4 font-medium text-fg-primary">
              Rouvrir la période #{reopeningId}
            </p>
            <label className="mb-1 block text-sm text-fg-secondary">
              Motif de la réouverture *
            </label>
            <input
              type="text"
              autoFocus
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="mb-3 w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary"
            />
            {reopenError && (
              <p className="mb-3 text-sm text-danger">{reopenError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={confirmReopen}
                disabled={reopening}
                className="rounded-md bg-accent-green px-4 py-2 font-medium text-on-accent hover:opacity-90 disabled:opacity-60"
              >
                {reopening ? "..." : "Confirmer"}
              </button>
              <button
                onClick={() => setReopeningId(null)}
                className="rounded-md border border-border-default px-4 py-2 text-fg-secondary hover:bg-surface-2"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
