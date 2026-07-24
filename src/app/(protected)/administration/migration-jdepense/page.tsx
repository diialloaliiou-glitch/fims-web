"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { hasRole } from "@/lib/roles";
import { FormField, fieldControlClass } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  JDEPENSE_IMPORT_COLUMNS,
  JDEPENSE_EXAMPLE_ROW,
  mapperEntetesJdepense,
  validerLignesJdepense,
  type JdepenseImportKey,
  type JdepenseImportRow,
} from "@/lib/jdepense-import";

// ============================================================================
// OUTIL DE MIGRATION TEMPORAIRE - a retirer une fois toutes les anciennes
// bases FIMS Excel chargees. Reserve a ADMIN_N1. Chemin d'insertion massive
// entierement separe du flux normal de saisie (ecran /saisie), qui n'est ni
// modifie ni reutilise ici.
// ============================================================================

type Mode = "" | "importer";

export default function MigrationJdepensePage() {
  const { profile, projects } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const estAdmin = hasRole(profile?.role, ["ADMIN_N1"]);

  const [targetProjectId, setTargetProjectId] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{
    rawObjects: Record<string, unknown>[];
    colonnesTrouvees: JdepenseImportKey[];
  } | null>(null);
  const [erreurFichier, setErreurFichier] = useState<string | null>(null);

  const [comptesValides, setComptesValides] = useState<Set<string>>(new Set());
  const [zonesInfo, setZonesInfo] = useState<Map<string, number>>(new Map());
  const [chargementRef, setChargementRef] = useState(false);

  const [doublons, setDoublons] = useState<Set<string> | null>(null);
  const [confirmingDoublons, setConfirmingDoublons] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rapport, setRapport] = useState<{ succes: number; rejetes: { rowNumber: number; errors: string[] }[] } | null>(
    null
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("");

  const targetProject = projects.find((p) => p.id === targetProjectId);

  useEffect(() => {
    if (!targetProjectId || !targetProject) {
      setComptesValides(new Set());
      setZonesInfo(new Map());
      return;
    }
    setChargementRef(true);
    Promise.all([
      supabase
        .from("chart_of_accounts")
        .select("ccompte")
        .eq("project_id", targetProjectId),
      supabase
        .from("zones")
        .select("id, code")
        .eq("organization_id", targetProject.organization_id),
    ]).then(([comptesRes, zonesRes]) => {
      setComptesValides(
        new Set(((comptesRes.data ?? []) as { ccompte: string }[]).map((c) => c.ccompte))
      );
      const map = new Map<string, number>();
      ((zonesRes.data ?? []) as { id: number; code: string }[]).forEach((z) =>
        map.set(z.code.toUpperCase(), z.id)
      );
      setZonesInfo(map);
      setChargementRef(false);
    });
  }, [targetProjectId, targetProject]);

  function telechargerModele() {
    const headerRow = JDEPENSE_IMPORT_COLUMNS.map((c) => c.header);
    const exampleRow = JDEPENSE_IMPORT_COLUMNS.map((c) => JDEPENSE_EXAMPLE_ROW[c.key]);
    const wsData = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
    const wsInstructions = XLSX.utils.aoa_to_sheet([
      ["Instructions"],
      ["- Ne modifie pas les en-têtes de la première ligne."],
      ["- Chaque ligne = une moitié d'écriture : colonne D remplie OU colonne C remplie, jamais les deux, jamais aucune."],
      ["- Pareil pour MT D / MT C : un seul des deux renseigné par ligne."],
      ["- Les codes de compte (D, C) doivent exister dans le plan comptable du projet cible."],
      ["- La colonne ZONE doit correspondre à un code de zone existant."],
      ["- Pour chaque N°E-J, la somme de MT D doit égaler la somme de MT C sur toutes ses lignes."],
      ["- Supprime la ligne d'exemple avant d'importer tes vraies données."],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsData, "JDEPENSE");
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
    XLSX.writeFile(wb, "Modele_Import_JDEPENSE.xlsx");
  }

  async function onFileSelected(file: File) {
    setErreurFichier(null);
    setRapport(null);
    setImportError(null);
    setDoublons(null);
    setConfirmingDoublons(false);
    setFileName(file.name);

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    if (rows.length === 0) {
      setErreurFichier("Fichier vide.");
      setParsed(null);
      return;
    }

    const headerRow = (rows[0] ?? []).map((v) => String(v ?? ""));
    const mapped = mapperEntetesJdepense(headerRow);

    if (!mapped.includes("n_ecriture_journal") || !mapped.includes("n_piece")) {
      setErreurFichier("Colonnes N°E-J et/ou N°PIECE introuvables — vérifie les en-têtes.");
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
      colonnesTrouvees: mapped.filter((k): k is JdepenseImportKey => k !== null),
    });
  }

  const lignes: JdepenseImportRow[] = useMemo(() => {
    if (!parsed) return [];
    return validerLignesJdepense(parsed.rawObjects, parsed.colonnesTrouvees, comptesValides, zonesInfo);
  }, [parsed, comptesValides, zonesInfo]);

  const lignesValides = lignes.filter((l) => l.errors.length === 0);
  const lignesRejetees = lignes.filter((l) => l.errors.length > 0);

  async function verifierDoublonsEtImporter() {
    if (!targetProjectId || !profile || lignesValides.length === 0) return;
    setImportError(null);
    setMode("importer");

    const nPieces = [...new Set(lignesValides.map((l) => l.values.n_piece as string))];
    const { data: existants } = await supabase
      .from("journal_entries")
      .select("n_piece, date_operation, montant_debit, montant_credit")
      .eq("project_id", targetProjectId)
      .in("n_piece", nPieces);

    const clesExistantes = new Set(
      ((existants ?? []) as { n_piece: string | null; date_operation: string; montant_debit: number; montant_credit: number }[]).map(
        (e) => `${e.n_piece}|${e.date_operation}|${e.montant_debit}|${e.montant_credit}`
      )
    );

    const doublonsTrouves = new Set<string>();
    lignesValides.forEach((l) => {
      const cle = `${l.values.n_piece}|${l.dateOperationIso}|${l.values.montant_debit ?? 0}|${l.values.montant_credit ?? 0}`;
      if (clesExistantes.has(cle)) doublonsTrouves.add(cle);
    });

    if (doublonsTrouves.size > 0) {
      setDoublons(doublonsTrouves);
      setConfirmingDoublons(true);
      return;
    }

    await lancerImport();
  }

  async function lancerImport() {
    if (!targetProjectId || !profile) return;
    setImporting(true);
    setImportError(null);

    const rowsToInsert = lignesValides.map((l) => ({
      organization_id: targetProject?.organization_id,
      project_id: targetProjectId,
      date_operation: l.dateOperationIso,
      tag_projet_local: (l.values.tag_projet_local as string | null) || null,
      budget_line: (l.values.budget_line as string | null) || null,
      categorie: (l.values.categorie as string | null) || null,
      type_operation: (l.values.type_operation as string | null) || null,
      b_s_line: (l.values.b_s_line as string | null) || null,
      journal: (l.values.journal as string | null) || null,
      n_ecriture_journal: (l.values.n_ecriture_journal as string | null) || null,
      compte_debit: (l.values.compte_debit as string | null) || null,
      compte_credit: (l.values.compte_credit as string | null) || null,
      tiers: (l.values.tiers as string | null) || null,
      ref_fact_d: (l.values.ref_fact_d as string | null) || null,
      n_cheque_ov: (l.values.n_cheque_ov as string | null) || null,
      n_lettrage: (l.values.n_lettrage as string | null) || null,
      n_piece: (l.values.n_piece as string | null) || null,
      zone_id: l.zoneId,
      montant_debit: (l.values.montant_debit as number | null) ?? 0,
      montant_credit: (l.values.montant_credit as number | null) ?? 0,
      libelle: (l.values.libelle as string | null) ?? "",
      idc: (l.values.idc as string | null) || null,
      date_heure_saisie: l.dateHeureSaisieIso ?? new Date().toISOString(),
      utilisateur: (l.values.utilisateur as string | null) || profile.nom_utilisateur,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("journal_entries")
      .insert(rowsToInsert)
      .select("id");

    setImporting(false);
    setConfirmingDoublons(false);

    if (insertError) {
      setImportError(`Erreur : ${insertError.message}`);
      return;
    }

    setRapport({
      succes: inserted?.length ?? 0,
      rejetes: lignesRejetees.map((l) => ({ rowNumber: l.rowNumber, errors: l.errors })),
    });
    setParsed(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!estAdmin) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">Migration JDEPENSE</h1>
        <p className="text-sm text-text-secondary">
          Cet outil est réservé à ADMIN_N1.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 rounded-xl border-2 border-accent-amber bg-accent-amber/10 p-4">
        <p className="text-sm font-bold text-accent-amber">⚠ OUTIL TEMPORAIRE DE MIGRATION</p>
        <p className="mt-1 text-sm text-text-secondary">
          Import en masse des anciennes écritures JDEPENSE depuis l&apos;ancien FIMS Excel. Cet
          écran sera retiré une fois toutes les bases historiques chargées — indépendant du flux
          normal de saisie.
        </p>
      </div>

      <h1 className="mb-6 text-2xl font-semibold text-text-primary">Import JDEPENSE (migration Excel)</h1>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border-subtle bg-bg-card p-4">
        <FormField label="Projet cible">
          <select
            value={targetProjectId}
            onChange={(e) => setTargetProjectId(e.target.value)}
            className={fieldControlClass}
          >
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code_projet} — {p.nom_projet}
              </option>
            ))}
          </select>
        </FormField>
        <button
          type="button"
          onClick={telechargerModele}
          className="rounded-md border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:bg-bg-card-muted"
        >
          Télécharger le modèle
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-border-subtle bg-bg-card p-4">
        <p className="mb-2 text-sm font-medium text-text-secondary">Dépose ton fichier Excel (.xlsx)</p>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            disabled={!targetProjectId || chargementRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelected(file);
            }}
            className="text-sm text-text-secondary"
          />
          {fileName && <span className="text-sm text-text-primary">{fileName}</span>}
        </div>
        {!targetProjectId && (
          <p className="mt-2 text-sm text-accent-amber">Choisis d&apos;abord un projet cible.</p>
        )}
        {erreurFichier && <p className="mt-2 text-sm text-accent-red">{erreurFichier}</p>}
      </div>

      {parsed && lignes.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-text-secondary">Aperçu ({lignes.length})</p>
            <p className="text-sm">
              <span className="text-accent-teal">{lignesValides.length} valide(s)</span>
              {" · "}
              <span className="text-accent-red">{lignesRejetees.length} rejetée(s)</span>
            </p>
          </div>

          <div className="mb-6 max-h-[65vh] overflow-auto rounded-xl border border-border-subtle">
            <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
              <MiniTableHeader
                columns={["Ligne", ...JDEPENSE_IMPORT_COLUMNS.map((c) => c.header), "Erreurs"]}
                align={["right", ...JDEPENSE_IMPORT_COLUMNS.map(() => "left" as const), "left"]}
              />
              <tbody className="divide-y divide-border-subtle bg-bg-card/60">
                {lignes.map((l) => (
                  <tr
                    key={l.rowNumber}
                    className={l.errors.length > 0 ? "bg-accent-red/5 text-text-primary" : "text-text-primary"}
                  >
                    <td className="px-3 py-2 text-right">{l.rowNumber}</td>
                    {JDEPENSE_IMPORT_COLUMNS.map((c) => (
                      <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                        {l.values[c.key] ?? ""}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-accent-red">{l.errors.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importError && <p className="mb-3 text-sm text-accent-red">{importError}</p>}

          {!confirmingDoublons ? (
            <PrimaryButton
              onClick={verifierDoublonsEtImporter}
              disabled={lignesValides.length === 0 || importing || mode === "importer" && importing}
            >
              {importing
                ? "Import..."
                : `Importer les ${lignesValides.length} ligne(s) valide(s)`}
            </PrimaryButton>
          ) : (
            <div className="rounded-xl border border-accent-red bg-accent-red/10 p-4">
              <p className="mb-1 font-semibold text-accent-red">Doublons potentiels détectés</p>
              <p className="mb-3 text-sm text-text-primary">
                {doublons?.size} ligne(s) correspondent déjà à une écriture existante (même N°Pièce
                + date + montant) dans ce projet. Importer quand même risque de créer des doublons.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={lancerImport}
                  disabled={importing}
                  className="rounded-md bg-accent-red px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {importing ? "Import..." : "Oui, importer malgré tout"}
                </button>
                <button
                  onClick={() => setConfirmingDoublons(false)}
                  className="rounded-md border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:bg-bg-card"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {rapport && (
        <div className="mt-6 rounded-xl border border-border-subtle bg-bg-card p-4">
          <p className="mb-2 font-semibold text-accent-teal">
            {rapport.succes} ligne(s) importée(s) avec succès.
          </p>
          {rapport.rejetes.length > 0 && (
            <>
              <p className="mb-2 font-semibold text-accent-red">
                {rapport.rejetes.length} ligne(s) rejetée(s) :
              </p>
              <ul className="space-y-1 text-sm text-text-secondary">
                {rapport.rejetes.map((r) => (
                  <li key={r.rowNumber}>
                    Ligne {r.rowNumber} : {r.errors.join(" ")}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
