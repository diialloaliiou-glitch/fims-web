"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  BUDGET_IMPORT_COLUMNS,
  BUDGET_EXAMPLE_ROW,
  mapperEntetes,
  validerLignes,
  type BudgetImportKey,
  type BudgetImportRow,
} from "@/lib/budget-import";

type Mode = "ajouter" | "remplacer" | "";

export default function ImportBudgetPage() {
  const { profile, project, projects } = useAuth();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [targetProjectId, setTargetProjectId] = useState(project?.id ?? "");
  const [mode, setMode] = useState<Mode>("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{
    rawObjects: Record<string, unknown>[];
    colonnesTrouvees: BudgetImportKey[];
  } | null>(null);
  const [ourLineCodesExistants, setOurLineCodesExistants] = useState<Set<string>>(new Set());
  const [erreurFichier, setErreurFichier] = useState<string | null>(null);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (project?.id) chargerCodesExistants(project.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  async function chargerCodesExistants(projectId: string) {
    const { data } = await supabase
      .from("budget_lines")
      .select("our_line_code")
      .eq("project_id", projectId);
    setOurLineCodesExistants(
      new Set(
        ((data ?? []) as { our_line_code: string | null }[])
          .map((r) => r.our_line_code?.trim().toUpperCase())
          .filter((v): v is string => !!v)
      )
    );
  }

  function onProjectChange(id: string) {
    setTargetProjectId(id);
    chargerCodesExistants(id);
  }

  function telechargerModele() {
    const headerRow = BUDGET_IMPORT_COLUMNS.map((c) => c.header);
    const exampleRow = BUDGET_IMPORT_COLUMNS.map((c) => BUDGET_EXAMPLE_ROW[c.key]);
    const wsData = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
    const wsInstructions = XLSX.utils.aoa_to_sheet([
      ["Instructions"],
      ["- Ne modifie pas les en-têtes de la première ligne."],
      ["- OUR LINE CODE est obligatoire et doit être unique dans le projet."],
      ["- Quantity, Frequence, Unit Cost, Total Cost, Ajustement, Unit Cost/DEVISE doivent être numériques ou vides."],
      ["- Supprime la ligne d'exemple avant d'importer tes vraies données."],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsData, "DATABASE");
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
    XLSX.writeFile(wb, "Modele_Import_Budget.xlsx");
  }

  async function onFileSelected(file: File) {
    setErreurFichier(null);
    setImportResult(null);
    setImportError(null);
    setFileName(file.name);

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    if (rows.length === 0) {
      setErreurFichier(t.budgetImport.erreurColonneManquante);
      setParsed(null);
      return;
    }

    const headerRow = (rows[0] ?? []).map((v) => String(v ?? ""));
    const mapped = mapperEntetes(headerRow);

    if (!mapped.includes("our_line_code")) {
      setErreurFichier(t.budgetImport.erreurColonneManquante);
      setParsed(null);
      return;
    }

    const dataRows = rows
      .slice(1)
      .filter((r) => r.some((cell) => cell !== "" && cell !== null && cell !== undefined));

    const rawObjects = dataRows.map((r) => {
      const obj: Record<string, unknown> = {};
      mapped.forEach((key, idx) => {
        if (key) obj[key] = r[idx];
      });
      return obj;
    });

    setParsed({
      rawObjects,
      colonnesTrouvees: mapped.filter((k): k is BudgetImportKey => k !== null),
    });
  }

  const lignes: BudgetImportRow[] = useMemo(() => {
    if (!parsed) return [];
    return validerLignes(
      parsed.rawObjects,
      parsed.colonnesTrouvees,
      mode === "remplacer" ? new Set() : ourLineCodesExistants
    );
  }, [parsed, mode, ourLineCodesExistants]);

  const nbErreurs = lignes.filter((l) => l.errors.length > 0).length;
  const peutImporter = lignes.length > 0 && nbErreurs === 0 && mode !== "" && !!targetProjectId;

  async function lancerImport() {
    if (!profile || !targetProjectId) return;
    setImporting(true);
    setImportError(null);

    if (mode === "remplacer") {
      const { error: deleteError } = await supabase
        .from("budget_lines")
        .delete()
        .eq("project_id", targetProjectId);
      if (deleteError) {
        setImporting(false);
        setImportError(`Erreur : ${deleteError.message}`);
        return;
      }
    }

    const rowsToInsert = lignes.map((l) => ({
      ...l.values,
      organization_id: profile.organization_id,
      project_id: targetProjectId,
    }));

    const { error: insertError } = await supabase.from("budget_lines").insert(rowsToInsert);

    setImporting(false);
    setConfirmingReplace(false);

    if (insertError) {
      setImportError(`Erreur : ${insertError.message}`);
      return;
    }

    setImportResult(rowsToInsert.length);
    setParsed(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    chargerCodesExistants(targetProjectId);
  }

  function handleConfirmerClick() {
    if (mode === "remplacer") {
      setConfirmingReplace(true);
    } else {
      lancerImport();
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">{t.budgetImport.titre}</h1>
        <Link href="/parametres/budget" className="text-sm text-accent-blue hover:underline">
          {t.budgetImport.voirBudget} →
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border-subtle bg-bg-card p-4">
        {projects.length > 1 && (
          <FormField label={t.budgetImport.projetCible}>
            <select
              value={targetProjectId}
              onChange={(e) => onProjectChange(e.target.value)}
              className={fieldControlClass}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code_projet} — {p.nom_projet}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <button
          type="button"
          onClick={telechargerModele}
          className="rounded-md border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:bg-bg-card-muted"
        >
          {t.budgetImport.telechargerModele}
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-border-subtle bg-bg-card p-4">
        <p className="mb-2 text-sm font-medium text-text-secondary">
          {t.budgetImport.deposerFichier}
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelected(file);
            }}
            className="text-sm text-text-secondary"
          />
          {fileName && <span className="text-sm text-text-primary">{fileName}</span>}
        </div>
        {erreurFichier && (
          <p className="mt-2 text-sm text-accent-red">{erreurFichier}</p>
        )}
      </div>

      {parsed && lignes.length > 0 && (
        <>
          <div className="mb-6 rounded-xl border border-border-subtle bg-bg-card p-4">
            <p className="mb-3 text-sm font-medium text-text-secondary">{t.budgetImport.mode}</p>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "ajouter"}
                  onChange={() => setMode("ajouter")}
                />
                {t.budgetImport.modeAjouter}
              </label>
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "remplacer"}
                  onChange={() => setMode("remplacer")}
                />
                {t.budgetImport.modeRemplacer}
              </label>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-text-secondary">
              {t.budgetImport.apercu} ({lignes.length})
            </p>
            {nbErreurs > 0 ? (
              <p className="text-sm text-accent-red">
                {t.budgetImport.lignesAvecErreurs.replace("{count}", String(nbErreurs))}
              </p>
            ) : (
              <p className="text-sm text-accent-teal">{t.budgetImport.aucuneErreur}</p>
            )}
          </div>

          <div className="mb-6 max-h-[65vh] overflow-auto rounded-xl border border-border-subtle">
            <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
              <MiniTableHeader
                columns={[
                  t.budgetImport.colLigne,
                  ...BUDGET_IMPORT_COLUMNS.map((c) => c.header),
                  t.budgetImport.colErreurs,
                ]}
                align={["right", ...BUDGET_IMPORT_COLUMNS.map(() => "left" as const), "left"]}
              />
              <tbody className="divide-y divide-border-subtle bg-bg-card/60">
                {lignes.map((l) => (
                  <tr
                    key={l.rowNumber}
                    className={l.errors.length > 0 ? "bg-accent-red/5 text-text-primary" : "text-text-primary"}
                  >
                    <td className="px-3 py-2 text-right">{l.rowNumber}</td>
                    {BUDGET_IMPORT_COLUMNS.map((c) => (
                      <td key={c.key} className="px-3 py-2">
                        {l.values[c.key] ?? ""}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-accent-red">
                      {l.errors.join(" ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importError && <p className="mb-3 text-sm text-accent-red">{importError}</p>}
          {nbErreurs === 0 && mode === "" && (
            <p className="mb-3 text-sm text-accent-amber">{t.budgetImport.erreurModeObligatoire}</p>
          )}

          {!confirmingReplace ? (
            <PrimaryButton onClick={handleConfirmerClick} disabled={!peutImporter || importing}>
              {importing ? t.budgetImport.importation : t.budgetImport.confirmerImport}
            </PrimaryButton>
          ) : (
            <div className="rounded-xl border border-accent-red bg-accent-red/10 p-4">
              <p className="mb-1 font-semibold text-accent-red">
                {t.budgetImport.confirmerRemplacementTitre}
              </p>
              <p className="mb-3 text-sm text-text-primary">
                {t.budgetImport.confirmerRemplacementTexte.replace(
                  "{count}",
                  String(ourLineCodesExistants.size)
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={lancerImport}
                  disabled={importing}
                  className="rounded-md bg-accent-red px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {importing ? t.budgetImport.importation : t.budgetImport.ouiRemplacer}
                </button>
                <button
                  onClick={() => setConfirmingReplace(false)}
                  className="rounded-md border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:bg-bg-card"
                >
                  {t.common.annuler}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {importResult !== null && (
        <p className="mt-4 text-sm text-accent-teal">
          {t.budgetImport.importReussi.replace("{count}", String(importResult))}
        </p>
      )}
    </div>
  );
}
