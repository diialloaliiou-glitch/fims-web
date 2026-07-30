"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { Pill } from "@/components/ui/Pill";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { NavigationSecondaire } from "@/components/ui/NavigationSecondaire";
import { SignatureBlock } from "@/components/ui/SignatureBlock";
import type {
  CategorieEcartErb,
  ErbReconciliation,
  ErbReconciliationItem,
  Profile,
  Project,
} from "@/lib/types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const emptyNouveau = {
  banque: "",
  no_compte: "",
  titulaire_compte: "",
  droit_signature: "",
  devise: "FCFA",
  racine_compte: "",
  date_finale: todayIso(),
  solde_releve_bancaire: "",
  date_releve: todayIso(),
};

function NouveauRapprochementForm({
  project,
  profile,
  onCreated,
}: {
  project: Project | null;
  profile: Profile | null;
  onCreated: (id: number) => void;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState(emptyNouveau);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const racine = form.racine_compte.trim();
    if (!form.date_finale) {
      setError(t.erb.erreurDateFinaleObligatoire);
      return;
    }
    if (!racine) {
      setError(t.grandLivre.erreurRacineVide);
      return;
    }
    if (!/^\d+$/.test(racine)) {
      setError(t.grandLivre.erreurRacineNonNumerique);
      return;
    }
    if (racine.length < 3) {
      setError(t.grandLivre.erreurRacineTropCourte);
      return;
    }
    if (!project || !profile) return;

    setSaving(true);

    const { data, error: insertError } = await supabase
      .from("erb_reconciliations")
      .insert({
        organization_id: profile.organization_id,
        project_id: project.id,
        banque: form.banque.trim() || null,
        no_compte: form.no_compte.trim() || null,
        titulaire_compte: form.titulaire_compte.trim() || null,
        droit_signature: form.droit_signature.trim() || null,
        devise: form.devise.trim() || null,
        racine_compte: racine,
        date_finale: form.date_finale,
        solde_releve_bancaire: parseFloat(form.solde_releve_bancaire) || 0,
        date_releve: form.date_releve || null,
      })
      .select("id")
      .single();

    setSaving(false);

    if (insertError || !data) {
      setError(`Erreur : ${insertError?.message ?? "inconnue"}`);
      return;
    }

    setForm(emptyNouveau);
    onCreated(data.id);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-border-subtle bg-bg-card p-4"
    >
      <p className="mb-3 font-semibold text-text-primary">{t.erb.nouveauRapprochement}</p>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField
          label={t.erb.banque}
          value={form.banque}
          onChange={(e) => setForm({ ...form, banque: e.target.value })}
        />
        <FormField
          label={t.erb.noCompte}
          value={form.no_compte}
          onChange={(e) => setForm({ ...form, no_compte: e.target.value })}
        />
        <FormField
          label={t.erb.titulaireCompte}
          value={form.titulaire_compte}
          onChange={(e) => setForm({ ...form, titulaire_compte: e.target.value })}
        />
        <FormField
          label={t.erb.droitSignature}
          value={form.droit_signature}
          onChange={(e) => setForm({ ...form, droit_signature: e.target.value })}
        />
        <FormField
          label={t.erb.devise}
          value={form.devise}
          onChange={(e) => setForm({ ...form, devise: e.target.value })}
        />
        <FormField
          label={t.grandLivre.racineCompte}
          required
          value={form.racine_compte}
          onChange={(e) => setForm({ ...form, racine_compte: e.target.value })}
          placeholder={t.grandLivre.racineComptePlaceholder}
        />
        <FormField
          label={t.erb.dateFinale}
          required
          type="date"
          value={form.date_finale}
          onChange={(e) => setForm({ ...form, date_finale: e.target.value })}
        />
        <FormField
          label={t.erb.soldeReleveBancaire}
          type="number"
          step="0.01"
          value={form.solde_releve_bancaire}
          onChange={(e) => setForm({ ...form, solde_releve_bancaire: e.target.value })}
        />
        <FormField
          label={t.erb.dateReleve}
          type="date"
          value={form.date_releve}
          onChange={(e) => setForm({ ...form, date_releve: e.target.value })}
        />
      </div>
      {error && <p className="mb-2 text-xs text-accent-red">{error}</p>}
      <PrimaryButton type="submit" disabled={saving}>
        {saving ? "..." : t.erb.creer}
      </PrimaryButton>
    </form>
  );
}

function ListeRapprochements({
  reconciliations,
  loading,
  onSelect,
}: {
  reconciliations: ErbReconciliation[];
  loading: boolean;
  onSelect: (id: number) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card">
      <p className="border-b border-border-subtle px-4 py-3 font-semibold text-text-primary">
        {t.erb.historique}
      </p>
      {loading ? (
        <p className="px-4 py-3 text-text-secondary">{t.common.chargement}</p>
      ) : reconciliations.length === 0 ? (
        <p className="px-4 py-3 text-text-secondary">{t.erb.aucunRapprochement}</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {reconciliations.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => onSelect(r.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-text-primary hover:bg-bg-card-teal/20"
              >
                <span>
                  {new Date(r.date_finale).toLocaleDateString("fr-FR")} — {r.banque || "—"}{" "}
                  {r.no_compte ? `(${r.no_compte})` : ""}
                </span>
                <span className="font-medium">
                  {r.solde_releve_bancaire.toLocaleString("fr-FR")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemSection({
  reconciliationId,
  categorie,
  titre,
  items,
  signeFixe,
  onAdded,
}: {
  reconciliationId: number;
  categorie: CategorieEcartErb;
  titre: string;
  items: ErbReconciliationItem[];
  signeFixe: 1 | -1 | null;
  onAdded: () => void;
}) {
  const { t } = useLanguage();
  const [noJustificatif, setNoJustificatif] = useState("");
  const [noCheque, setNoCheque] = useState("");
  const [montant, setMontant] = useState("");
  const [signe, setSigne] = useState<1 | -1>(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const total = items.reduce((s, i) => s + i.montant, 0);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const val = parseFloat(montant);
    if (!val || val <= 0) {
      setError(t.erb.erreurMontantPositif);
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from("erb_reconciliation_items").insert({
      reconciliation_id: reconciliationId,
      categorie,
      no_justificatif: noJustificatif.trim() || null,
      no_cheque: noCheque.trim() || null,
      montant: signeFixe ? val : val * signe,
    });
    setSaving(false);
    if (insertError) {
      setError(`Erreur : ${insertError.message}`);
      return;
    }
    setNoJustificatif("");
    setNoCheque("");
    setMontant("");
    onAdded();
  }

  async function handleDelete(id: number) {
    await supabase.from("erb_reconciliation_items").delete().eq("id", id);
    onAdded();
  }

  return (
    <div className="mb-4 rounded-xl border border-border-subtle bg-bg-card p-4">
      <p className="mb-3 text-sm font-semibold text-text-primary">{titre}</p>

      <div className="overflow-auto rounded-lg border border-border-subtle">
        <table className="min-w-full text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
          <MiniTableHeader
            columns={[t.erb.noJustificatif, t.erb.noCheque, t.erb.montant, t.common.action]}
            align={["left", "left", "right", "right"]}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {items.map((i) => (
              <tr key={i.id} className="text-text-primary">
                <td className="px-2 py-1.5">{i.no_justificatif}</td>
                <td className="px-2 py-1.5">{i.no_cheque}</td>
                <td className="px-2 py-1.5 text-right">{i.montant.toLocaleString("fr-FR")}</td>
                <td className="px-2 py-1.5 text-right print:hidden">
                  <button
                    onClick={() => handleDelete(i.id)}
                    className="text-accent-red hover:underline"
                  >
                    {t.common.supprimer}
                  </button>
                </td>
              </tr>
            ))}

            {/* Total unique - voir grand-livre/reporting pour la meme
                correction : <tfoot> se reproduit nativement sur chaque
                page imprimee, donc rendu comme derniere ligne de <tbody>. */}
            <tr className="bg-bg-card font-semibold text-text-primary">
              <td className="px-2 py-1.5" colSpan={2}>
                {t.common.total}
              </td>
              <td className="px-2 py-1.5 text-right">{total.toLocaleString("fr-FR")}</td>
              <td className="px-2 py-1.5" />
            </tr>
          </tbody>
        </table>
      </div>

      <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-end gap-3 print:hidden">
        <FormField
          label={t.erb.noJustificatif}
          value={noJustificatif}
          onChange={(e) => setNoJustificatif(e.target.value)}
        />
        <FormField
          label={t.erb.noCheque}
          value={noCheque}
          onChange={(e) => setNoCheque(e.target.value)}
        />
        <FormField
          label={t.erb.montant}
          type="number"
          step="0.01"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
        />
        {!signeFixe && (
          <FormField label="+/-">
            <select
              value={signe}
              onChange={(e) => setSigne(Number(e.target.value) as 1 | -1)}
              className={fieldControlClass}
            >
              <option value={1}>+</option>
              <option value={-1}>-</option>
            </select>
          </FormField>
        )}
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? "..." : t.erb.ajouter}
        </PrimaryButton>
      </form>
      {error && <p className="mt-2 text-xs text-accent-red">{error}</p>}
    </div>
  );
}

function DetailRapprochement({
  reconciliation,
  project,
  onBack,
  onChanged,
}: {
  reconciliation: ErbReconciliation;
  project: Project | null;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [items, setItems] = useState<ErbReconciliationItem[]>([]);
  const [soldeJournal, setSoldeJournal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadDetail() {
    if (!project) return;
    setLoading(true);

    const [itemsRes, entriesRes] = await Promise.all([
      supabase
        .from("erb_reconciliation_items")
        .select("*")
        .eq("reconciliation_id", reconciliation.id),
      // Reproduit ERB!E5='GRAND LIVRE'!G1 du FIMS Excel d'origine : le solde
      // comptable est SUM(debit)-SUM(credit) du compte (racine_compte),
      // pour toutes les ecritures jusqu'a la date finale incluse.
      supabase
        .from("journal_entries")
        .select("compte_debit, compte_credit, montant_debit, montant_credit")
        .eq("project_id", project.id)
        .lte("date_operation", reconciliation.date_finale),
    ]);

    setItems((itemsRes.data as ErbReconciliationItem[]) ?? []);

    const solde = (
      (entriesRes.data as
        | { compte_debit: string | null; compte_credit: string | null; montant_debit: number; montant_credit: number }[]
        | null) ?? []
    )
      .filter(
        (en) =>
          (en.compte_debit ?? "").startsWith(reconciliation.racine_compte) ||
          (en.compte_credit ?? "").startsWith(reconciliation.racine_compte)
      )
      .reduce((s, en) => s + en.montant_debit - en.montant_credit, 0);
    setSoldeJournal(solde);

    setLoading(false);
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconciliation.id]);

  function refresh() {
    loadDetail();
    onChanged();
  }

  async function handleDeleteReconciliation() {
    // .select() force la requete a renvoyer la ligne reellement supprimee -
    // sans ca, une policy RLS qui bloque silencieusement la suppression
    // passerait inapercue.
    const { data } = await supabase
      .from("erb_reconciliations")
      .delete()
      .eq("id", reconciliation.id)
      .select("id");

    if (!data || data.length === 0) return;

    onChanged();
    onBack();
  }

  if (loading || soldeJournal === null) {
    return <p className="text-text-secondary">{t.common.chargement}</p>;
  }

  const debits = items.filter((i) => i.categorie === "debit_non_apparu");
  const credits = items.filter((i) => i.categorie === "credit_non_apparu");
  const erreurs = items.filter((i) => i.categorie === "erreur_banque");

  const differenceI = reconciliation.solde_releve_bancaire - soldeJournal;
  const differenceII =
    debits.reduce((s, i) => s + i.montant, 0) -
    credits.reduce((s, i) => s + i.montant, 0) +
    erreurs.reduce((s, i) => s + i.montant, 0);
  const proof = differenceI - differenceII;
  const equilibre = Math.abs(proof) < 1;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <button onClick={onBack} className="text-sm text-accent-blue hover:underline">
          {t.erb.retourListe}
        </button>
        <div className="flex items-center gap-4">
          <Pill onClick={() => window.print()}>{t.common.exportPdf}</Pill>
          <Pill solid onClick={() => window.print()}>
            {t.common.imprimer}
          </Pill>
          <button
            onClick={handleDeleteReconciliation}
            className="text-sm text-accent-red hover:underline"
          >
            {t.common.supprimer}
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border-subtle bg-bg-card p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-text-secondary">{t.erb.banque}</p>
          <p className="font-medium text-text-primary">{reconciliation.banque || "—"}</p>
        </div>
        <div>
          <p className="text-text-secondary">{t.erb.noCompte}</p>
          <p className="font-medium text-text-primary">{reconciliation.no_compte || "—"}</p>
        </div>
        <div>
          <p className="text-text-secondary">{t.erb.titulaireCompte}</p>
          <p className="font-medium text-text-primary">
            {reconciliation.titulaire_compte || "—"}
          </p>
        </div>
        <div>
          <p className="text-text-secondary">{t.erb.droitSignature}</p>
          <p className="font-medium text-text-primary">
            {reconciliation.droit_signature || "—"}
          </p>
        </div>
        <div>
          <p className="text-text-secondary">{t.erb.devise}</p>
          <p className="font-medium text-text-primary">{reconciliation.devise || "—"}</p>
        </div>
        <div>
          <p className="text-text-secondary">{t.erb.dateFinale}</p>
          <p className="font-medium text-text-primary">
            {new Date(reconciliation.date_finale).toLocaleDateString("fr-FR")}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <p className="text-sm text-text-secondary">{t.erb.soldeReleveBancaire}</p>
          <p className="text-xl font-semibold text-text-primary">
            {reconciliation.solde_releve_bancaire.toLocaleString("fr-FR")}
          </p>
          {reconciliation.date_releve && (
            <p className="text-xs text-text-secondary">
              {t.erb.dateReleve} {new Date(reconciliation.date_releve).toLocaleDateString("fr-FR")}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
          <p className="text-sm text-text-secondary">{t.erb.soldeComptabiliteJournal}</p>
          <p className="text-xl font-semibold text-text-primary">
            {soldeJournal.toLocaleString("fr-FR")}
          </p>
          <p className="text-xs text-text-secondary">
            {t.erb.dateReleve} {new Date(reconciliation.date_finale).toLocaleDateString("fr-FR")}{" "}
            ({t.grandLivre.racineCompte} {reconciliation.racine_compte}...)
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border-subtle bg-bg-card p-4 text-sm">
        <span className="font-semibold text-text-primary">{t.erb.differenceI} : </span>
        <span className="font-bold text-text-primary">{differenceI.toLocaleString("fr-FR")}</span>
      </div>

      <p className="mb-3 font-semibold text-text-primary">{t.erb.explicationDifference}</p>

      <ItemSection
        reconciliationId={reconciliation.id}
        categorie="debit_non_apparu"
        titre={t.erb.debitsNonApparus}
        items={debits}
        signeFixe={1}
        onAdded={refresh}
      />
      <ItemSection
        reconciliationId={reconciliation.id}
        categorie="credit_non_apparu"
        titre={t.erb.creditsNonApparus}
        items={credits}
        signeFixe={-1}
        onAdded={refresh}
      />
      <ItemSection
        reconciliationId={reconciliation.id}
        categorie="erreur_banque"
        titre={t.erb.erreursBanque}
        items={erreurs}
        signeFixe={null}
        onAdded={refresh}
      />

      <div className="mb-4 rounded-xl border border-border-subtle bg-bg-card p-4 text-sm">
        <span className="font-semibold text-text-primary">{t.erb.totalDifferenceII} : </span>
        <span className="font-bold text-text-primary">
          {differenceII.toLocaleString("fr-FR")}
        </span>
      </div>

      <div
        className={`mb-6 rounded-xl border p-4 text-sm ${
          equilibre
            ? "border-accent-teal bg-bg-card-teal text-accent-teal"
            : "border-accent-amber bg-accent-amber/10 text-accent-amber"
        }`}
      >
        {t.erb.proof} : <span className="font-bold">{proof.toLocaleString("fr-FR")}</span>
        {equilibre ? ` ${t.erb.rapprochementEquilibre}` : ` ${t.erb.aInvestiguer}`}
      </div>
    </div>
  );
}

export default function ErbPage() {
  const { project, profile } = useAuth();
  const { t } = useLanguage();
  const [reconciliations, setReconciliations] = useState<ErbReconciliation[]>([]);
  const [loadingListe, setLoadingListe] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  async function loadReconciliations() {
    if (!project) return;
    setLoadingListe(true);
    const { data } = await supabase
      .from("erb_reconciliations")
      .select("*")
      .eq("project_id", project.id)
      .order("date_finale", { ascending: false });
    setReconciliations((data as ErbReconciliation[]) ?? []);
    setLoadingListe(false);
  }

  useEffect(() => {
    loadReconciliations();
    setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const selected = reconciliations.find((r) => r.id === selectedId) ?? null;

  return (
    <div>
      <NavigationSecondaire actuel="erb" />

      <h1 className="mb-2 text-2xl font-semibold text-text-primary">{t.erb.titre}</h1>
      <p className="text-sm text-text-secondary">
        {project?.nom_projet} ({project?.code_projet})
      </p>
      <p className="mb-6 text-sm text-text-secondary print:hidden">{t.erb.description}</p>

      {selected ? (
        <DetailRapprochement
          reconciliation={selected}
          project={project}
          onBack={() => setSelectedId(null)}
          onChanged={loadReconciliations}
        />
      ) : (
        <>
          <NouveauRapprochementForm
            project={project}
            profile={profile}
            onCreated={async (id) => {
              await loadReconciliations();
              setSelectedId(id);
            }}
          />
          <ListeRapprochements
            reconciliations={reconciliations}
            loading={loadingListe}
            onSelect={setSelectedId}
          />
        </>
      )}

      <SignatureBlock project={project} profile={profile} />
    </div>
  );
}
