"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { periodeCouranteFermee } from "@/lib/period-closure";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { ChartOfAccount, JournalEntry, ThirdParty, Zone } from "@/lib/types";

const JOURNAUX = ["AC", "BQ", "OD", "SA"];
const TYPES_OPERATION = [
  "AVANCE et REGU",
  "PRISE EN CHARGE",
  "REGLEMENT",
  "REVERSEMENT",
  "TRESORERIE",
];

function firstOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type EditForm = {
  date_operation: string;
  journal: string;
  n_ecriture_journal: string;
  n_piece: string;
  type_operation: string;
  b_s_line: string;
  compte_debit: string;
  compte_credit: string;
  montant_debit: string;
  montant_credit: string;
  tiers: string;
  libelle: string;
  ref_fact_d: string;
  n_cheque_ov: string;
  zone_id: string;
  tag_projet_local: string;
};

function toEditForm(e: JournalEntry): EditForm {
  return {
    date_operation: e.date_operation.slice(0, 10),
    journal: e.journal ?? JOURNAUX[0],
    n_ecriture_journal: e.n_ecriture_journal ?? "",
    n_piece: e.n_piece ?? "",
    type_operation: e.type_operation ?? TYPES_OPERATION[0],
    b_s_line: e.b_s_line ?? "",
    compte_debit: e.compte_debit ?? "",
    compte_credit: e.compte_credit ?? "",
    montant_debit: e.montant_debit ? String(e.montant_debit) : "",
    montant_credit: e.montant_credit ? String(e.montant_credit) : "",
    tiers: e.tiers ?? "",
    libelle: e.libelle,
    ref_fact_d: e.ref_fact_d ?? "",
    n_cheque_ov: e.n_cheque_ov ?? "",
    zone_id: e.zone_id != null ? String(e.zone_id) : "",
    tag_projet_local: e.tag_projet_local ?? "",
  };
}

export default function JdepensePage() {
  const { profile, project } = useAuth();
  const { t } = useLanguage();

  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  const [dateDebut, setDateDebut] = useState(firstOfMonthIso());
  const [dateFin, setDateFin] = useState(todayIso());
  const [compteFiltre, setCompteFiltre] = useState("");
  const [nejFiltre, setNejFiltre] = useState("");
  const [tiersFiltre, setTiersFiltre] = useState("");

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadEntries() {
    if (!project) return;
    setLoading(true);

    let query = supabase
      .from("journal_entries")
      .select("*")
      .eq("project_id", project.id)
      .gte("date_operation", dateDebut)
      .lte("date_operation", dateFin)
      .order("date_operation", { ascending: false })
      .order("n_ecriture_journal", { ascending: false })
      // A l'interieur d'une meme ecriture, la ligne Debit est toujours
      // inseree avant la ligne Credit (id plus petit) - trier par id
      // croissant ici garantit Debit avant Credit, quel que soit l'ordre
      // choisi entre les ecritures elles-memes.
      .order("id", { ascending: true });

    if (compteFiltre) {
      query = query.or(`compte_debit.eq.${compteFiltre},compte_credit.eq.${compteFiltre}`);
    }
    if (nejFiltre.trim()) {
      query = query.ilike("n_ecriture_journal", `%${nejFiltre.trim()}%`);
    }
    if (tiersFiltre.trim()) {
      query = query.ilike("tiers", `%${tiersFiltre.trim()}%`);
    }

    const { data } = await query;
    setEntries((data as JournalEntry[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, dateDebut, dateFin, compteFiltre, nejFiltre, tiersFiltre]);

  useEffect(() => {
    if (!project) return;
    supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("project_id", project.id)
      .order("ccompte")
      .then(({ data }) => setAccounts((data as ChartOfAccount[]) ?? []));

    supabase
      .from("third_parties")
      .select("*")
      .eq("project_id", project.id)
      .then(({ data }) => setThirdParties((data as ThirdParty[]) ?? []));

    supabase
      .from("zones")
      .select("*")
      .eq("organization_id", project.organization_id)
      .order("code")
      .then(({ data }) => setZones((data as Zone[]) ?? []));
  }, [project]);

  function startEdit(e: JournalEntry) {
    setEditingId(e.id);
    setForm(toEditForm(e));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(null);
    setError(null);
  }

  async function handleSave() {
    if (!form || editingId === null || !project || !profile) return;
    setError(null);

    const montantDebit = form.montant_debit ? parseFloat(form.montant_debit) : 0;
    const montantCredit = form.montant_credit ? parseFloat(form.montant_credit) : 0;

    if (!form.compte_debit.trim() && !form.compte_credit.trim()) {
      setError(t.jdepense.erreurCompteObligatoire);
      return;
    }
    if (!montantDebit && !montantCredit) {
      setError(t.jdepense.erreurMontantObligatoire);
      return;
    }
    if (!form.libelle.trim()) {
      setError(t.jdepense.erreurLibelleObligatoire);
      return;
    }

    const blocageCloture = await periodeCouranteFermee(project.id);
    if (blocageCloture) {
      setError(blocageCloture);
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase
      .from("journal_entries")
      .update({
        date_operation: form.date_operation,
        journal: form.journal,
        n_ecriture_journal: form.n_ecriture_journal || null,
        n_piece: form.n_piece || null,
        type_operation: form.type_operation,
        b_s_line: form.b_s_line || null,
        compte_debit: form.compte_debit.trim() || null,
        compte_credit: form.compte_credit.trim() || null,
        montant_debit: montantDebit,
        montant_credit: montantCredit,
        tiers: form.tiers || null,
        libelle: form.libelle.trim(),
        ref_fact_d: form.ref_fact_d || null,
        n_cheque_ov: form.n_cheque_ov || null,
        zone_id: form.zone_id ? parseInt(form.zone_id, 10) : null,
        tag_projet_local: form.tag_projet_local || null,
        modifie_par: profile.nom_utilisateur,
        modifie_le: new Date().toISOString(),
      })
      .eq("id", editingId);

    setSaving(false);

    if (updateError) {
      setError(`Erreur : ${updateError.message}`);
      return;
    }

    cancelEdit();
    loadEntries();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {t.jdepense.titre}
      </h1>

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-border-subtle bg-bg-card p-4">
        <FormField label={t.jdepense.compte}>
          <select
            value={compteFiltre}
            onChange={(e) => setCompteFiltre(e.target.value)}
            className={fieldControlClass}
          >
            <option value="">{t.jdepense.tousLesComptes}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.ccompte}>
                {a.ccompte} - {a.libelle}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={t.common.du} type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
        <FormField label={t.common.au} type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
        <FormField
          label={t.jdepense.nEJ}
          value={nejFiltre}
          onChange={(e) => setNejFiltre(e.target.value)}
          placeholder={t.jdepense.nEJPlaceholder}
        />
        <FormField
          label={t.jdepense.tiers}
          value={tiersFiltre}
          onChange={(e) => setTiersFiltre(e.target.value)}
          placeholder={t.jdepense.tiersPlaceholder}
        />
      </div>

      {editingId !== null && form && (
        <div className="mb-6 rounded-xl border border-border-subtle bg-bg-card p-6">
          <p className="mb-4 text-sm font-medium text-text-secondary">
            {t.jdepense.modifierEcriture}{editingId}
          </p>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <FormField
              label={t.jdepense.dateLabel}
              required
              type="date"
              value={form.date_operation}
              onChange={(e) => setForm({ ...form, date_operation: e.target.value })}
            />
            <FormField label={t.jdepense.journal} required>
              <select
                value={form.journal}
                onChange={(e) => setForm({ ...form, journal: e.target.value })}
                className={fieldControlClass}
              >
                {JOURNAUX.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label={t.jdepense.nEJ}
              value={form.n_ecriture_journal}
              onChange={(e) => setForm({ ...form, n_ecriture_journal: e.target.value })}
            />
            <FormField
              label={t.jdepense.nPiece}
              value={form.n_piece}
              onChange={(e) => setForm({ ...form, n_piece: e.target.value })}
            />
            <FormField label={t.jdepense.typeOperation} required>
              <select
                value={form.type_operation}
                onChange={(e) => setForm({ ...form, type_operation: e.target.value })}
                className={fieldControlClass}
              >
                {TYPES_OPERATION.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label={t.jdepense.bSLine}
              value={form.b_s_line}
              onChange={(e) => setForm({ ...form, b_s_line: e.target.value })}
            />
            <FormField label={t.jdepense.zone}>
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
            <FormField label={t.jdepense.tiers}>
              <input
                list="jdepense-tiers-list"
                type="text"
                value={form.tiers}
                onChange={(e) => setForm({ ...form, tiers: e.target.value })}
                className={fieldControlClass}
              />
              <datalist id="jdepense-tiers-list">
                {thirdParties.map((tp) => (
                  <option key={tp.id} value={tp.nom_tiers} />
                ))}
              </datalist>
            </FormField>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <FormField label={t.jdepense.nCompteDebit}>
              <input
                list="jdepense-comptes-list"
                type="text"
                value={form.compte_debit}
                onChange={(e) => setForm({ ...form, compte_debit: e.target.value })}
                className={fieldControlClass}
              />
            </FormField>
            <FormField
              label={t.jdepense.montantDebit}
              type="number"
              step="0.01"
              value={form.montant_debit}
              onChange={(e) => setForm({ ...form, montant_debit: e.target.value })}
            />
            <FormField label={t.jdepense.nCompteCredit}>
              <input
                list="jdepense-comptes-list"
                type="text"
                value={form.compte_credit}
                onChange={(e) => setForm({ ...form, compte_credit: e.target.value })}
                className={fieldControlClass}
              />
            </FormField>
            <FormField
              label={t.jdepense.montantCredit}
              type="number"
              step="0.01"
              value={form.montant_credit}
              onChange={(e) => setForm({ ...form, montant_credit: e.target.value })}
            />
            <datalist id="jdepense-comptes-list">
              {accounts.map((a) => (
                <option key={a.id} value={a.ccompte}>
                  {a.libelle}
                </option>
              ))}
            </datalist>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <FormField
                label={t.jdepense.libelle}
                required
                value={form.libelle}
                onChange={(e) => setForm({ ...form, libelle: e.target.value })}
              />
            </div>
            <FormField
              label={t.jdepense.refFactD}
              value={form.ref_fact_d}
              onChange={(e) => setForm({ ...form, ref_fact_d: e.target.value })}
            />
            <FormField
              label={t.jdepense.nChqOv}
              value={form.n_cheque_ov}
              onChange={(e) => setForm({ ...form, n_cheque_ov: e.target.value })}
            />
          </div>

          <div className="mb-4 max-w-xs">
            <FormField
              label={t.jdepense.tagProjetLocal}
              value={form.tag_projet_local}
              onChange={(e) => setForm({ ...form, tag_projet_local: e.target.value })}
              placeholder={project?.code_projet}
            />
          </div>

          {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

          <div className="flex gap-3">
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? t.common.enregistrement : t.common.enregistrer}
            </PrimaryButton>
            <button
              onClick={cancelEdit}
              className="rounded-md border border-border-subtle px-5 py-2 text-text-secondary hover:bg-bg-card"
            >
              {t.common.annuler}
            </button>
          </div>
        </div>
      )}

      <div className="max-h-[65vh] overflow-auto rounded-xl border border-border-subtle print:max-h-none print:overflow-visible">
        <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
          <MiniTableHeader
            columns={[
              t.jdepense.colIndex,
              t.jdepense.colDate,
              t.jdepense.colProjectId,
              t.jdepense.colBudgetLine,
              t.jdepense.colCategorie,
              t.jdepense.colTypeOperation,
              t.jdepense.colBSLine,
              t.jdepense.colJournal,
              t.jdepense.colNEJ,
              t.jdepense.colD,
              t.jdepense.colC,
              t.jdepense.colTiers,
              t.jdepense.colRefFactD,
              t.jdepense.colNChqOv,
              t.jdepense.colNLtr,
              t.jdepense.colNPiece,
              t.jdepense.colZone,
              t.jdepense.colMtD,
              t.jdepense.colMtC,
              t.jdepense.colLibelle,
              t.jdepense.colIdc,
              t.jdepense.colDateHeureSaisie,
              t.jdepense.colUtilisateur,
              t.common.action,
            ]}
            align={[
              "right", "left", "left", "left", "left", "left", "left", "left", "left",
              "left", "left", "left", "left", "left", "left", "left", "left",
              "right", "right", "left", "left", "left", "left", "right",
            ]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td colSpan={24} className="px-3 py-4 text-center text-text-secondary">
                  {t.common.chargement}
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={24} className="px-3 py-4 text-center text-text-secondary">
                  {t.jdepense.aucuneEcriture}
                </td>
              </tr>
            )}
            {entries.map((e, idx) => (
              <tr key={e.id} className="text-text-primary">
                <td className="px-3 py-2 text-right">{idx + 1}</td>
                <td className="px-3 py-2">
                  {new Date(e.date_operation).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-3 py-2">{e.tag_projet_local}</td>
                <td className="px-3 py-2">{e.budget_line}</td>
                <td className="px-3 py-2">{e.categorie}</td>
                <td className="px-3 py-2">{e.type_operation}</td>
                <td className="px-3 py-2">{e.b_s_line}</td>
                <td className="px-3 py-2">{e.journal}</td>
                <td className="px-3 py-2">{e.n_ecriture_journal}</td>
                <td className="px-3 py-2">{e.compte_debit}</td>
                <td className="px-3 py-2">{e.compte_credit}</td>
                <td className="px-3 py-2">{e.tiers}</td>
                <td className="px-3 py-2">{e.ref_fact_d}</td>
                <td className="px-3 py-2">{e.n_cheque_ov}</td>
                <td className="px-3 py-2">{e.n_lettrage}</td>
                <td className="px-3 py-2">{e.n_piece}</td>
                <td className="px-3 py-2">
                  {e.zone_id != null ? zones.find((z) => z.id === e.zone_id)?.code ?? "" : ""}
                </td>
                <td className="px-3 py-2 text-right">
                  {e.montant_debit ? e.montant_debit.toLocaleString("fr-FR") : ""}
                </td>
                <td className="px-3 py-2 text-right">
                  {e.montant_credit ? e.montant_credit.toLocaleString("fr-FR") : ""}
                </td>
                <td className="px-3 py-2">{e.libelle}</td>
                <td className="px-3 py-2">{e.idc}</td>
                <td className="px-3 py-2">
                  {new Date(e.date_heure_saisie).toLocaleString("fr-FR")}
                </td>
                <td className="px-3 py-2">{e.utilisateur}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => startEdit(e)}
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
