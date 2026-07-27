"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import type { BudgetLine, Personnel, PersonnelRepartition } from "@/lib/types";

type LigneForm = {
  id: number;
  project_id: string;
  b_s_line: string;
  budget_line: string;
  pourcentage: string;
  note: string;
};

let ligneIdCounter = 1;

function todayIso() {
  return new Date().toISOString().slice(0, 7);
}

function moisPrecedent(mois: string) {
  const [y, m] = mois.split("-").map((v) => parseInt(v, 10));
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function moisLabel(mois: string) {
  const [y, m] = mois.split("-").map((v) => parseInt(v, 10));
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function ligneVide(): LigneForm {
  return { id: ligneIdCounter++, project_id: "", b_s_line: "", budget_line: "", pourcentage: "", note: "" };
}

export function PersonnelRepartitionModal({
  employe,
  onClose,
}: {
  employe: Personnel;
  onClose: () => void;
}) {
  const { projects } = useAuth();
  const { t } = useLanguage();

  const [mois, setMois] = useState(todayIso());
  const [lignes, setLignes] = useState<LigneForm[]>([]);
  const [budgetLinesParProjet, setBudgetLinesParProjet] = useState<Map<string, BudgetLine[]>>(new Map());
  const [lignesMoisPrecedent, setLignesMoisPrecedent] = useState<PersonnelRepartition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(
      projects.map((p) =>
        supabase.from("budget_lines").select("*").eq("project_id", p.id).then(({ data }) => [p.id, (data as BudgetLine[]) ?? []] as const)
      )
    ).then((paires) => setBudgetLinesParProjet(new Map(paires)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  useEffect(() => {
    async function charger() {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const { data } = await supabase
        .from("personnel_repartition")
        .select("*")
        .eq("personnel_id", employe.id)
        .eq("mois", `${mois}-01`)
        .order("id");

      const existantes = (data as PersonnelRepartition[]) ?? [];
      setLignes(
        existantes.length > 0
          ? existantes.map((r) => ({
              id: ligneIdCounter++,
              project_id: r.project_id,
              b_s_line: r.b_s_line ?? "",
              budget_line: r.budget_line ?? "",
              pourcentage: String(r.pourcentage),
              note: r.note ?? "",
            }))
          : [ligneVide()]
      );

      if (existantes.length === 0) {
        const prev = moisPrecedent(mois);
        const { data: prevData } = await supabase
          .from("personnel_repartition")
          .select("*")
          .eq("personnel_id", employe.id)
          .eq("mois", `${prev}-01`);
        setLignesMoisPrecedent((prevData as PersonnelRepartition[]) ?? []);
      } else {
        setLignesMoisPrecedent([]);
      }

      setLoading(false);
    }
    charger();
  }, [employe.id, mois]);

  function dupliquerMoisPrecedent() {
    setLignes(
      lignesMoisPrecedent.map((r) => ({
        id: ligneIdCounter++,
        project_id: r.project_id,
        b_s_line: r.b_s_line ?? "",
        budget_line: r.budget_line ?? "",
        pourcentage: String(r.pourcentage),
        note: r.note ?? "",
      }))
    );
  }

  function ajouterLigne() {
    setLignes([...lignes, ligneVide()]);
  }

  function supprimerLigne(id: number) {
    setLignes(lignes.filter((l) => l.id !== id));
  }

  function modifierLigne(id: number, champs: Partial<LigneForm>) {
    setLignes(lignes.map((l) => (l.id === id ? { ...l, ...champs } : l)));
  }

  function handleProjetChange(id: number, projectId: string) {
    modifierLigne(id, { project_id: projectId, b_s_line: "", budget_line: "" });
  }

  function handleBSLineChange(id: number, projectId: string, value: string) {
    const lignesBudget = budgetLinesParProjet.get(projectId) ?? [];
    const ligneBudget = lignesBudget.find((b) => (b.our_line_code ?? "").toUpperCase() === value.toUpperCase());
    modifierLigne(id, { b_s_line: value, budget_line: ligneBudget?.budget_line ?? "" });
  }

  const sommePourcentage = lignes.reduce((s, l) => s + (parseFloat(l.pourcentage) || 0), 0);
  const sommeValide = Math.round(sommePourcentage * 100) === 10000;

  async function handleSave() {
    setError(null);
    setSuccess(null);

    if (lignes.length === 0) {
      setError(t.personnel.repartition.erreurAuMoinsUneLigne);
      return;
    }
    if (lignes.some((l) => !l.project_id)) {
      setError(t.personnel.repartition.erreurProjetObligatoire);
      return;
    }
    const projetsVus = new Set<string>();
    for (const l of lignes) {
      if (projetsVus.has(l.project_id)) {
        setError(t.personnel.repartition.erreurProjetDuplique);
        return;
      }
      projetsVus.add(l.project_id);
    }
    if (!sommeValide) {
      setError(`${t.personnel.repartition.erreurSomme} (${sommePourcentage.toLocaleString("fr-FR")}%).`);
      return;
    }

    const projet0 = projects.find((p) => p.id === lignes[0].project_id);
    if (!projet0) return;

    setSaving(true);

    await supabase
      .from("personnel_repartition")
      .delete()
      .eq("personnel_id", employe.id)
      .eq("mois", `${mois}-01`);

    const { error: insertError } = await supabase.from("personnel_repartition").insert(
      lignes.map((l) => ({
        organization_id: projet0.organization_id,
        personnel_id: employe.id,
        mois: `${mois}-01`,
        project_id: l.project_id,
        budget_line: l.budget_line || null,
        b_s_line: l.b_s_line || null,
        pourcentage: parseFloat(l.pourcentage) || 0,
        note: l.note.trim() || null,
      }))
    );

    setSaving(false);

    if (insertError) {
      setError(`Erreur : ${insertError.message}`);
      return;
    }

    setSuccess(t.personnel.repartition.enregistree);
    setLignesMoisPrecedent([]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl border border-border-subtle bg-bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold text-text-primary">
            {t.personnel.repartition.titre} — {employe.prenom_nom} ({employe.matricule})
          </p>
          <button onClick={onClose} className="text-sm text-accent-blue hover:underline">
            {t.common.annuler}
          </button>
        </div>

        <div className="mb-4 max-w-xs">
          <FormField
            label={t.personnel.repartition.mois}
            type="month"
            value={mois}
            onChange={(e) => setMois(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-sm text-text-secondary">{t.common.chargement}</p>
        ) : (
          <>
            {lignesMoisPrecedent.length > 0 && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-border-subtle bg-bg-card-muted p-3">
                <p className="text-sm text-text-secondary">
                  {t.personnel.repartition.suggestionDuplication.replace("{mois}", moisLabel(moisPrecedent(mois)))}
                </p>
                <button
                  onClick={dupliquerMoisPrecedent}
                  className="whitespace-nowrap text-sm font-medium text-accent-teal hover:underline"
                >
                  {t.personnel.repartition.dupliquer.replace("{mois}", moisLabel(moisPrecedent(mois)))}
                </button>
              </div>
            )}

            <div className="mb-4 overflow-auto rounded-lg border border-border-subtle">
              <table className="min-w-full text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
                <MiniTableHeader
                  columns={[
                    t.personnel.repartition.projet,
                    t.personnel.repartition.bSLine,
                    t.personnel.repartition.budgetLine,
                    t.personnel.repartition.pourcentage,
                    t.personnel.repartition.note,
                    "",
                  ]}
                  align={["left", "left", "left", "right", "left", "left"]}
                />
                <tbody className="divide-y divide-border-subtle bg-bg-card/60">
                  {lignes.map((l) => {
                    const lignesBudget = budgetLinesParProjet.get(l.project_id) ?? [];
                    return (
                      <tr key={l.id}>
                        <td className="px-2 py-1.5">
                          <select
                            value={l.project_id}
                            onChange={(e) => handleProjetChange(l.id, e.target.value)}
                            className={fieldControlClass}
                          >
                            <option value="">—</option>
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.code_projet ?? p.nom_projet}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={l.b_s_line}
                            onChange={(e) => handleBSLineChange(l.id, l.project_id, e.target.value)}
                            className={fieldControlClass}
                            disabled={!l.project_id}
                          >
                            <option value="">—</option>
                            {lignesBudget.map((b) => (
                              <option key={b.id} value={b.our_line_code ?? ""}>
                                {b.our_line_code}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-text-secondary">{l.budget_line}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={l.pourcentage}
                            onChange={(e) => modifierLigne(l.id, { pourcentage: e.target.value })}
                            className={`${fieldControlClass} text-right`}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={l.note}
                            onChange={(e) => modifierLigne(l.id, { note: e.target.value })}
                            className={fieldControlClass}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button onClick={() => supprimerLigne(l.id)} className="text-accent-red hover:underline">
                            {t.saisie.retirer}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-bg-card font-semibold text-text-primary">
                  <tr>
                    <td className="px-2 py-1.5" colSpan={3}>
                      {t.common.total}
                    </td>
                    <td className={`px-2 py-1.5 text-right ${sommeValide ? "text-accent-teal" : "text-accent-red"}`}>
                      {sommePourcentage.toLocaleString("fr-FR")}%
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <button onClick={ajouterLigne} className="mb-4 text-sm text-accent-blue hover:underline">
              {t.personnel.repartition.ajouterLigne}
            </button>

            {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}
            {success && <p className="mb-3 text-sm text-accent-teal">{success}</p>}

            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? t.common.enregistrement : t.common.enregistrer}
            </PrimaryButton>
          </>
        )}
      </div>
    </div>
  );
}
