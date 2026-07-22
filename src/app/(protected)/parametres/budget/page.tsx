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
import type { BudgetLine, ProjectOutput } from "@/lib/types";

type ColonneAffichee = {
  key: string;
  header: string;
  align: "left" | "right";
  render: (l: BudgetLine) => string;
};

export default function BudgetDataPage() {
  const { profile, project } = useAuth();
  const { t } = useLanguage();
  const peutImporter = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"]);
  const [lignes, setLignes] = useState<BudgetLine[]>([]);
  const [outputsParId, setOutputsParId] = useState<Map<number, ProjectOutput>>(new Map());
  const [recherche, setRecherche] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    Promise.all([
      supabase.from("budget_lines").select("*").eq("project_id", project.id).order("code_1"),
      supabase.from("project_outputs").select("*").eq("project_id", project.id),
    ]).then(([lignesRes, outputsRes]) => {
      setLignes((lignesRes.data as BudgetLine[]) ?? []);
      const map = new Map<number, ProjectOutput>();
      ((outputsRes.data as ProjectOutput[]) ?? []).forEach((o) => map.set(o.id, o));
      setOutputsParId(map);
      setLoading(false);
    });
  }, [project]);

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
      if (c.key === "output_code") {
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
          </tbody>
          {filtrees.length > 0 && (
            <tfoot className="bg-bg-card font-semibold text-text-primary">
              <tr>
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
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
