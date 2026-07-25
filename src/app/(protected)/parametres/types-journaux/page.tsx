"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { hasRole } from "@/lib/roles";
import { FormField } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { BankJournal, OperationType } from "@/lib/types";

export default function TypesEtJournauxPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const canManage = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"]);

  const [types, setTypes] = useState<OperationType[]>([]);
  const [journaux, setJournaux] = useState<BankJournal[]>([]);
  const [loading, setLoading] = useState(true);

  const [typeCode, setTypeCode] = useState("");
  const [savingType, setSavingType] = useState(false);
  const [erreurType, setErreurType] = useState<string | null>(null);
  const [deletingTypeId, setDeletingTypeId] = useState<number | null>(null);
  const [deleteErrorType, setDeleteErrorType] = useState<string | null>(null);

  const [journalCode, setJournalCode] = useState("");
  const [journalLibelle, setJournalLibelle] = useState("");
  const [savingJournal, setSavingJournal] = useState(false);
  const [erreurJournal, setErreurJournal] = useState<string | null>(null);
  const [deletingJournalId, setDeletingJournalId] = useState<number | null>(null);
  const [deleteErrorJournal, setDeleteErrorJournal] = useState<string | null>(null);

  async function loadAll() {
    if (!profile) return;
    setLoading(true);
    const [typesRes, journauxRes] = await Promise.all([
      supabase.from("operation_types").select("*").eq("organization_id", profile.organization_id).order("code"),
      supabase.from("bank_journals").select("*").eq("organization_id", profile.organization_id).order("code"),
    ]);
    setTypes((typesRes.data as OperationType[]) ?? []);
    setJournaux((journauxRes.data as BankJournal[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleAjouterType(e: React.FormEvent) {
    e.preventDefault();
    setErreurType(null);
    if (!typeCode.trim()) {
      setErreurType("Le code est obligatoire.");
      return;
    }
    if (!profile) return;

    setSavingType(true);
    const { error } = await supabase
      .from("operation_types")
      .insert({ organization_id: profile.organization_id, code: typeCode.trim() });
    setSavingType(false);

    if (error) {
      setErreurType(`Erreur : ${error.message}`);
      return;
    }
    setTypeCode("");
    loadAll();
  }

  async function handleSupprimerType(tOp: OperationType) {
    setDeleteErrorType(null);
    setDeletingTypeId(tOp.id);

    const { count } = await supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("type_operation", tOp.code);

    if (count && count > 0) {
      setDeletingTypeId(null);
      setDeleteErrorType(`Impossible de supprimer : ${count} écriture(s) utilisent encore ce type.`);
      return;
    }

    const { error } = await supabase.from("operation_types").delete().eq("id", tOp.id);
    setDeletingTypeId(null);
    if (error) {
      setDeleteErrorType(`Erreur : ${error.message}`);
      return;
    }
    loadAll();
  }

  async function handleAjouterJournal(e: React.FormEvent) {
    e.preventDefault();
    setErreurJournal(null);
    if (!journalCode.trim()) {
      setErreurJournal("Le code est obligatoire.");
      return;
    }
    if (!profile) return;

    setSavingJournal(true);
    const { error } = await supabase.from("bank_journals").insert({
      organization_id: profile.organization_id,
      code: journalCode.trim().toUpperCase(),
      libelle: journalLibelle.trim() || null,
    });
    setSavingJournal(false);

    if (error) {
      setErreurJournal(`Erreur : ${error.message}`);
      return;
    }
    setJournalCode("");
    setJournalLibelle("");
    loadAll();
  }

  async function handleSupprimerJournal(j: BankJournal) {
    setDeleteErrorJournal(null);
    setDeletingJournalId(j.id);

    const { count } = await supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("journal", j.code);

    if (count && count > 0) {
      setDeletingJournalId(null);
      setDeleteErrorJournal(`Impossible de supprimer : ${count} écriture(s) utilisent encore ce journal.`);
      return;
    }

    const { error } = await supabase.from("bank_journals").delete().eq("id", j.id);
    setDeletingJournalId(null);
    if (error) {
      setDeleteErrorJournal(`Erreur : ${error.message}`);
      return;
    }
    loadAll();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        Types d&apos;opération &amp; Journaux
      </h1>
      <p className="mb-6 text-sm text-text-secondary">
        Listes de référence communes à l&apos;organisation, utilisées lors de la saisie et validées
        à l&apos;import.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">Types d&apos;opération</h2>
          {canManage && (
            <form
              onSubmit={handleAjouterType}
              className="mb-4 rounded-xl border border-border-subtle bg-bg-card p-4"
            >
              <div className="mb-3 flex items-end gap-3">
                <div className="flex-1">
                  <FormField
                    label="Code"
                    placeholder="Ex: PRISE EN CHARGE"
                    value={typeCode}
                    onChange={(e) => setTypeCode(e.target.value)}
                  />
                </div>
                <PrimaryButton type="submit" disabled={savingType}>
                  {savingType ? "..." : "Créer"}
                </PrimaryButton>
              </div>
              {erreurType && <p className="text-sm text-accent-red">{erreurType}</p>}
            </form>
          )}
          {deleteErrorType && <p className="mb-3 text-sm text-accent-red">{deleteErrorType}</p>}
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-border-subtle">
            <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
              <MiniTableHeader columns={["Code", "Action"]} align={["left", "right"]} />
              <tbody className="divide-y divide-border-subtle bg-bg-card/60">
                {loading && (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-center text-text-secondary">
                      {t.common.chargement}
                    </td>
                  </tr>
                )}
                {!loading && types.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-center text-text-secondary">
                      Aucun type enregistré.
                    </td>
                  </tr>
                )}
                {types.map((tOp) => (
                  <tr key={tOp.id} className="text-text-primary">
                    <td className="px-3 py-2">{tOp.code}</td>
                    <td className="px-3 py-2 text-right">
                      {canManage && (
                        <button
                          onClick={() => handleSupprimerType(tOp)}
                          disabled={deletingTypeId === tOp.id}
                          className="text-accent-red hover:underline disabled:opacity-60"
                        >
                          {deletingTypeId === tOp.id ? "..." : t.common.supprimer}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">Journaux</h2>
          {canManage && (
            <form
              onSubmit={handleAjouterJournal}
              className="mb-4 rounded-xl border border-border-subtle bg-bg-card p-4"
            >
              <div className="mb-3 grid grid-cols-2 gap-3">
                <FormField
                  label="Code"
                  placeholder="Ex: BQ"
                  value={journalCode}
                  onChange={(e) => setJournalCode(e.target.value)}
                />
                <FormField
                  label="Libellé"
                  placeholder="Ex: Banque"
                  value={journalLibelle}
                  onChange={(e) => setJournalLibelle(e.target.value)}
                />
              </div>
              <PrimaryButton type="submit" disabled={savingJournal}>
                {savingJournal ? "..." : "Créer"}
              </PrimaryButton>
              {erreurJournal && <p className="mt-2 text-sm text-accent-red">{erreurJournal}</p>}
            </form>
          )}
          {deleteErrorJournal && <p className="mb-3 text-sm text-accent-red">{deleteErrorJournal}</p>}
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-border-subtle">
            <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
              <MiniTableHeader columns={["Code", "Libellé", "Action"]} align={["left", "left", "right"]} />
              <tbody className="divide-y divide-border-subtle bg-bg-card/60">
                {loading && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-text-secondary">
                      {t.common.chargement}
                    </td>
                  </tr>
                )}
                {!loading && journaux.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-text-secondary">
                      Aucun journal enregistré.
                    </td>
                  </tr>
                )}
                {journaux.map((j) => (
                  <tr key={j.id} className="text-text-primary">
                    <td className="px-3 py-2">{j.code}</td>
                    <td className="px-3 py-2 text-text-secondary">{j.libelle}</td>
                    <td className="px-3 py-2 text-right">
                      {canManage && (
                        <button
                          onClick={() => handleSupprimerJournal(j)}
                          disabled={deletingJournalId === j.id}
                          className="text-accent-red hover:underline disabled:opacity-60"
                        >
                          {deletingJournalId === j.id ? "..." : t.common.supprimer}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
