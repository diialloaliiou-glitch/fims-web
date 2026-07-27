"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { periodeCouranteFermee } from "@/lib/period-closure";
import { makeBatchSequencer } from "@/lib/numerotation";
import {
  IncoherenceSalaireError,
  PAYROLL_MAPPING_KEYS,
  employesEligibles,
  genererLignesPaie,
  idcDuMois,
  type LignePaieGeneree,
} from "@/lib/paie";
import { FormField } from "@/components/ui/FormField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import type { Personnel, PersonnelRepartition, PayrollAccountMapping, PayrollMappingKey } from "@/lib/types";

function moisCourant() {
  return new Date().toISOString().slice(0, 7);
}

type Avertissement = { matricule: string; nom: string; raison: string };
type Groupe = { nej: string; nPiece: string; lignes: LignePaieGeneree[] };

export default function PaiePage() {
  const { profile, project } = useAuth();
  const { t } = useLanguage();

  const peutGenerer = profile?.role === "ADMIN_N1" || profile?.role === "COMPTABLE";

  const [mois, setMois] = useState(moisCourant());
  const [mode, setMode] = useState<"individuel" | "groupe">("individuel");

  const [groupes, setGroupes] = useState<Groupe[] | null>(null);
  const [avertissements, setAvertissements] = useState<Avertissement[]>([]);
  const [chargementApercu, setChargementApercu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleApercu() {
    if (!project || !profile) return;
    setError(null);
    setSuccess(null);
    setGroupes(null);
    setAvertissements([]);
    setChargementApercu(true);

    const { data: mappingRows } = await supabase
      .from("payroll_account_mapping")
      .select("*")
      .eq("project_id", project.id);

    const mapping = new Map<PayrollMappingKey, string>(
      ((mappingRows as PayrollAccountMapping[]) ?? []).map((r) => [r.cle, r.compte])
    );
    const clesManquantes = PAYROLL_MAPPING_KEYS.filter((k) => !mapping.get(k.cle));
    if (clesManquantes.length > 0) {
      setError(t.paie.erreurMappingIncomplet);
      setChargementApercu(false);
      return;
    }

    const { data: personnelData } = await supabase
      .from("personnel")
      .select("*")
      .eq("organization_id", profile.organization_id);
    const personnel = (personnelData as Personnel[]) ?? [];

    const eligibles = employesEligibles(personnel, mois);
    if (eligibles.length === 0) {
      setChargementApercu(false);
      setGroupes([]);
      return;
    }

    const { data: repartitionData } = await supabase
      .from("personnel_repartition")
      .select("*")
      .eq("mois", `${mois}-01`)
      .in("personnel_id", eligibles.map((e) => e.id));
    const repartitions = (repartitionData as PersonnelRepartition[]) ?? [];

    const idc = idcDuMois(mois);
    const { data: dejaTraiteData } = await supabase
      .from("journal_entries")
      .select("tiers")
      .eq("project_id", project.id)
      .eq("journal", "SA")
      .eq("idc", idc);
    const matriculesDejaTraites = new Set((dejaTraiteData ?? []).map((r) => r.tiers));

    const avert: Avertissement[] = [];
    const candidats: { employe: Personnel; pourcentage: number }[] = [];

    for (const e of eligibles) {
      const lignesEmploye = repartitions.filter((r) => r.personnel_id === e.id);
      const ligneProjetActif = lignesEmploye.find((r) => r.project_id === project.id);

      if (matriculesDejaTraites.has(e.matricule) && ligneProjetActif) {
        avert.push({ matricule: e.matricule, nom: e.prenom_nom, raison: t.paie.raisonDejaTraite });
        continue;
      }
      if (ligneProjetActif && ligneProjetActif.pourcentage > 0) {
        candidats.push({ employe: e, pourcentage: ligneProjetActif.pourcentage });
        continue;
      }
      if (lignesEmploye.length === 0 && e.project_id === project.id) {
        avert.push({ matricule: e.matricule, nom: e.prenom_nom, raison: t.paie.raisonRepartitionManquante });
      }
      // sinon : repartition definie mais pour d'autres projets uniquement -
      // cet employe n'est simplement pas concerne par ce projet ce mois-ci.
    }

    if (candidats.length === 0) {
      setAvertissements(avert);
      setGroupes([]);
      setChargementApercu(false);
      return;
    }

    const sequencer = makeBatchSequencer(project.id);
    const resultGroupes: Groupe[] = [];

    if (mode === "groupe") {
      const nej = await sequencer.next("n_ecriture_journal", "SA");
      const nPiece = await sequencer.next("n_piece", "PC");
      const lignes: LignePaieGeneree[] = [];
      for (const c of candidats) {
        try {
          lignes.push(
            ...genererLignesPaie({
              employe: c.employe,
              pourcentage: c.pourcentage,
              mois,
              mapping,
              project,
              profile,
              nej,
              nPiece,
            })
          );
        } catch (err) {
          avert.push({
            matricule: c.employe.matricule,
            nom: c.employe.prenom_nom,
            raison: err instanceof IncoherenceSalaireError ? err.message : t.paie.raisonErreurGeneration,
          });
        }
      }
      if (lignes.length > 0) resultGroupes.push({ nej, nPiece, lignes });
    } else {
      for (const c of candidats) {
        const nej = await sequencer.next("n_ecriture_journal", "SA");
        const nPiece = await sequencer.next("n_piece", "PC");
        try {
          const lignes = genererLignesPaie({
            employe: c.employe,
            pourcentage: c.pourcentage,
            mois,
            mapping,
            project,
            profile,
            nej,
            nPiece,
          });
          resultGroupes.push({ nej, nPiece, lignes });
        } catch (err) {
          avert.push({
            matricule: c.employe.matricule,
            nom: c.employe.prenom_nom,
            raison: err instanceof IncoherenceSalaireError ? err.message : t.paie.raisonErreurGeneration,
          });
        }
      }
    }

    setAvertissements(avert);
    setGroupes(resultGroupes);
    setChargementApercu(false);
  }

  async function handleValider() {
    if (!project || !groupes || groupes.length === 0) return;
    setError(null);
    setSuccess(null);

    const blocageCloture = await periodeCouranteFermee(project.id);
    if (blocageCloture) {
      setError(blocageCloture);
      return;
    }

    setSubmitting(true);

    const rows = groupes.flatMap((g) => g.lignes);
    const { error: insertError } = await supabase.from("journal_entries").insert(rows);

    setSubmitting(false);

    if (insertError) {
      setError(`${t.paie.erreurEnregistrement} ${insertError.message}`);
      return;
    }

    setSuccess(`${t.paie.transfereAvecSucces} (${rows.length} ${t.saisie.lignesLabel}, ${groupes.length} ${t.paie.ecrituresLabel}).`);
    setGroupes(null);
    setAvertissements([]);
  }

  if (!peutGenerer) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">{t.paie.titre}</h1>
        <p className="text-sm text-text-secondary">
          {t.saisie.permissionInfo.replace("{role}", profile?.role ?? "")}
        </p>
      </div>
    );
  }

  const totalDebit = (groupes ?? []).flatMap((g) => g.lignes).reduce((s, l) => s + l.montant_debit, 0);
  const totalCredit = (groupes ?? []).flatMap((g) => g.lignes).reduce((s, l) => s + l.montant_credit, 0);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-text-primary">{t.paie.titre}</h1>
      <p className="mb-6 text-sm text-text-secondary">
        {t.paie.description} {project?.code_projet}.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border-subtle bg-bg-card p-4">
        <div className="max-w-xs">
          <FormField label={t.paie.mois} type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
        </div>
        <FormField label={t.paie.mode}>
          <div className="flex h-[42px] items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm text-text-primary">
              <input type="radio" checked={mode === "individuel"} onChange={() => setMode("individuel")} />
              {t.paie.individuel}
            </label>
            <label className="flex items-center gap-1.5 text-sm text-text-primary">
              <input type="radio" checked={mode === "groupe"} onChange={() => setMode("groupe")} />
              {t.paie.groupe}
            </label>
          </div>
        </FormField>
        <PrimaryButton onClick={handleApercu} disabled={chargementApercu}>
          {chargementApercu ? t.common.chargement : t.paie.genererApercu}
        </PrimaryButton>
      </div>

      {error && <p className="mb-4 text-sm text-accent-red">{error}</p>}
      {success && <p className="mb-4 text-sm text-accent-teal">{success}</p>}

      {avertissements.length > 0 && (
        <div className="mb-6 rounded-xl border border-accent-amber/40 bg-bg-card p-4">
          <p className="mb-2 text-sm font-medium text-accent-amber">{t.paie.employesBloques}</p>
          <ul className="list-inside list-disc text-sm text-text-secondary">
            {avertissements.map((a, i) => (
              <li key={i}>
                {a.matricule} — {a.nom} : {a.raison}
              </li>
            ))}
          </ul>
        </div>
      )}

      {groupes !== null && groupes.length === 0 && avertissements.length === 0 && (
        <p className="mb-6 text-sm text-text-secondary">{t.paie.aucunEmploye}</p>
      )}

      {groupes !== null && groupes.length > 0 && (
        <>
          {groupes.map((g) => (
            <div key={g.nej} className="mb-6 overflow-auto rounded-xl border border-border-subtle">
              <div className="flex items-center justify-between bg-bg-card-muted px-4 py-2">
                <p className="text-sm font-medium text-text-primary">
                  {t.saisie.nJournal} {g.nej} — {t.saisie.nPiece} {g.nPiece}
                </p>
              </div>
              <table className="min-w-full text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
                <MiniTableHeader
                  columns={[
                    t.jdepense.tiers,
                    t.jdepense.nCompteDebit,
                    t.jdepense.nCompteCredit,
                    t.common.libelle,
                    t.saisie.colMontantD,
                    t.saisie.colMontantC,
                  ]}
                  align={["left", "left", "left", "left", "right", "right"]}
                />
                <tbody className="divide-y divide-border-subtle bg-bg-card/60">
                  {g.lignes.map((l, i) => (
                    <tr key={i} className="text-text-primary">
                      <td className="px-3 py-2">{l.tiers}</td>
                      <td className="px-3 py-2">{l.compte_debit}</td>
                      <td className="px-3 py-2">{l.compte_credit}</td>
                      <td className="px-3 py-2">{l.libelle}</td>
                      <td className="px-3 py-2 text-right">
                        {l.montant_debit ? l.montant_debit.toLocaleString("fr-FR") : ""}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {l.montant_credit ? l.montant_credit.toLocaleString("fr-FR") : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className="mb-6 flex items-center justify-between rounded-xl border border-border-subtle bg-bg-card p-4">
            <p className="text-sm font-semibold text-text-primary">
              {t.common.total} — {t.common.debit} {totalDebit.toLocaleString("fr-FR")} / {t.common.credit}{" "}
              {totalCredit.toLocaleString("fr-FR")}
            </p>
            <PrimaryButton onClick={handleValider} disabled={submitting}>
              {submitting ? t.common.enregistrement : t.paie.validerEtTransferer}
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}
