"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { hasRole } from "@/lib/roles";
import { FormField } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { BUDGET_IMPORT_COLUMNS, type BudgetImportColumn } from "@/lib/budget-import";
import type { BudgetLine, ProjectOutput, Secteur } from "@/lib/types";

type ColonneAffichee = {
  key: string;
  header: string;
  align: "left" | "right";
  render: (l: BudgetLine) => React.ReactNode;
};

export default function BudgetDataPage() {
  const { profile, project } = useAuth();
  const { t } = useLanguage();
  const peutImporter = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"]);
  const [lignes, setLignes] = useState<BudgetLine[]>([]);
  const [outputsParId, setOutputsParId] = useState<Map<number, ProjectOutput>>(new Map());
  const [secteurs, setSecteurs] = useState<Secteur[]>([]);
  const [recherche, setRecherche] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    Promise.all([
      supabase.from("budget_lines").select("*").eq("project_id", project.id).order("code_1"),
      supabase.from("project_outputs").select("*").eq("project_id", project.id),
      supabase.from("secteurs").select("*").eq("organization_id", project.organization_id).order("nom"),
    ]).then(([lignesRes, outputsRes, secteursRes]) => {
      setLignes((lignesRes.data as BudgetLine[]) ?? []);
      const map = new Map<number, ProjectOutput>();
      ((outputsRes.data as ProjectOutput[]) ?? []).forEach((o) => map.set(o.id, o));
      setOutputsParId(map);
      setSecteurs((secteursRes.data as Secteur[]) ?? []);
      setLoading(false);
    });
  }, [project]);

  // "Secteur" n'est jamais importe depuis l'Excel (pas de colonne dediee) -
  // assigne manuellement ligne par ligne ici, seul point d'entree pour
  // alimenter le KPI organisationnel "resultat par secteur".
  async function handleChangerSecteur(ligne: BudgetLine, secteur: string) {
    setLignes((prev) => prev.map((l) => (l.id === ligne.id ? { ...l, secteur: secteur || null } : l)));
    await supabase.from("budget_lines").update({ secteur: secteur || null }).eq("id", ligne.id);
  }

  const colonnesAffichees: ColonneAffichee[] = (() => {
    const standard = (c: BudgetImportColumn): ColonneAffichee => ({
      key: c.key,
      header: c.header,
      align: c.type === "number" ? "right" : "left",
      render: (l) => {
        const v = l[c.key as keyof BudgetLine];
        return v == null ? "" : c.type === "number" ? Number(v).toLocaleString("fr-FR") : String(v);
      },
    });

    const colonnes: ColonneAffichee[] = [];
    for (const c of BUDGET_IMPORT_COLUMNS) {
      if (c.key === "t_pec") {
        colonnes.push({
          key: "t_pec",
          header: c.header,
          align: "right",
          // t_pec est stocke en base comme une fraction (0.23 = 23%), pas
          // en pourcentage - reproduit le format d'affichage du "% TO
          // PROJECT" du Financial Report VBA (colonne G, format pourcentage).
          render: (l) => {
            if (l.t_pec == null || l.t_pec === "") return "";
            const n = Number(l.t_pec);
            return isNaN(n) ? l.t_pec : `${(n * 100).toFixed(0)}%`;
          },
        });
      } else if (c.key === "output_code") {
        colonnes.push({
          key: "categorie",
          header: t.budgetData.colCategorie,
          align: "left",
          render: (l) => l.categorie ?? "",
        });
        colonnes.push({
          key: "output_id",
          header: c.header,
          align: "left",
          render: (l) =>
            l.output_id != null
              ? outputsParId.get(l.output_id)?.label ?? ""
              : t.outputs.nonClasse,
        });
        colonnes.push({
          key: "secteur",
          header: t.budgetData.colSecteur,
          align: "left",
          render: (l) => (
            <select
              value={l.secteur ?? ""}
              onChange={(e) => handleChangerSecteur(l, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-md border border-border-subtle bg-bg-card px-2 py-1 text-xs text-text-primary"
            >
              <option value="">—</option>
              {secteurs.map((s) => (
                <option key={s.id} value={s.nom}>
                  {s.nom}
                </option>
              ))}
            </select>
          ),
        });
      } else {
        colonnes.push(standard(c));
      }
    }
    return colonnes;
  })();

  const filtrees = lignes.filter((l) => {
    if (!recherche.trim()) return true;
    const q = recherche.toLowerCase();
    return (
      (l.our_line_code ?? "").toLowerCase().includes(q) ||
      (l.budget_line ?? "").toLowerCase().includes(q) ||
      (l.description ?? "").toLowerCase().includes(q)
    );
  });

  const totalCost = filtrees.reduce((s, l) => s + (l.total_cost ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text-primary">{t.budgetData.titre}</h1>
        {peutImporter && (
          <Link
            href="/parametres/budget/import"
            className="text-sm text-accent-blue hover:underline"
          >
            {t.budgetData.importerBudget} →
          </Link>
        )}
      </div>

      <div className="mb-4 max-w-sm">
        <FormField
          label={t.common.filtrer}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder={t.budgetData.rechercherPlaceholder}
        />
      </div>

      <div className="max-h-[65vh] overflow-auto rounded-xl border border-border-subtle print:max-h-none print:overflow-visible">
        <table className="min-w-full table-auto text-sm [&_td]:border-r [&_td]:border-border-subtle [&_th]:border-r [&_th]:border-border-subtle [&_tr>*:last-child]:border-r-0">
          <MiniTableHeader
            columns={colonnesAffichees.map((c) => c.header)}
            align={colonnesAffichees.map((c) => c.align)}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td
                  colSpan={colonnesAffichees.length}
                  className="px-3 py-4 text-center text-text-secondary"
                >
                  {t.common.chargement}
                </td>
              </tr>
            )}
            {!loading && filtrees.length === 0 && (
              <tr>
                <td
                  colSpan={colonnesAffichees.length}
                  className="px-3 py-4 text-center text-text-secondary"
                >
                  {t.budgetData.aucuneLigne}
                </td>
              </tr>
            )}
            {filtrees.map((l) => (
              <tr key={l.id} className="text-text-primary">
                {colonnesAffichees.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2 ${c.align === "right" ? "text-right" : ""}`}
                  >
                    {c.render(l)}
                  </td>
                ))}
              </tr>
            ))}

            {/* Total unique - voir grand-livre/reporting pour la meme
                correction : <tfoot> se reproduit nativement sur chaque
                page imprimee, donc rendu comme derniere ligne de <tbody>. */}
            {filtrees.length > 0 && (
              <tr className="bg-bg-card font-semibold text-text-primary">
                <td
                  className="px-3 py-2"
                  colSpan={colonnesAffichees.findIndex((c) => c.key === "total_cost")}
                >
                  {t.common.total}
                </td>
                <td className="px-3 py-2 text-right">
                  {totalCost.toLocaleString("fr-FR")}
                </td>
                <td
                  className="px-3 py-2"
                  colSpan={
                    colonnesAffichees.length -
                    colonnesAffichees.findIndex((c) => c.key === "total_cost") -
                    1
                  }
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
