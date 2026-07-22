"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { hasRole } from "@/lib/roles";
import { FormField } from "@/components/ui/FormField";
import { MiniTableHeader } from "@/components/ui/MiniTableHeader";
import { BUDGET_IMPORT_COLUMNS } from "@/lib/budget-import";
import type { BudgetLine } from "@/lib/types";

export default function BudgetDataPage() {
  const { profile, project } = useAuth();
  const { t } = useLanguage();
  const peutImporter = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"]);
  const [lignes, setLignes] = useState<BudgetLine[]>([]);
  const [recherche, setRecherche] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    supabase
      .from("budget_lines")
      .select("*")
      .eq("project_id", project.id)
      .order("code_1")
      .then(({ data }) => {
        setLignes((data as BudgetLine[]) ?? []);
        setLoading(false);
      });
  }, [project]);

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
            columns={BUDGET_IMPORT_COLUMNS.map((c) => c.header)}
            align={BUDGET_IMPORT_COLUMNS.map((c) => (c.type === "number" ? "right" : "left"))}
          />
          <tbody className="divide-y divide-border-subtle bg-bg-card/60">
            {loading && (
              <tr>
                <td
                  colSpan={BUDGET_IMPORT_COLUMNS.length}
                  className="px-3 py-4 text-center text-text-secondary"
                >
                  {t.common.chargement}
                </td>
              </tr>
            )}
            {!loading && filtrees.length === 0 && (
              <tr>
                <td
                  colSpan={BUDGET_IMPORT_COLUMNS.length}
                  className="px-3 py-4 text-center text-text-secondary"
                >
                  {t.budgetData.aucuneLigne}
                </td>
              </tr>
            )}
            {filtrees.map((l) => (
              <tr key={l.id} className="text-text-primary">
                {BUDGET_IMPORT_COLUMNS.map((c) => {
                  const v = l[c.key];
                  return (
                    <td
                      key={c.key}
                      className={`px-3 py-2 ${c.type === "number" ? "text-right" : ""}`}
                    >
                      {v == null ? "" : c.type === "number" ? Number(v).toLocaleString("fr-FR") : v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {filtrees.length > 0 && (
            <tfoot className="bg-bg-card font-semibold text-text-primary">
              <tr>
                <td
                  className="px-3 py-2"
                  colSpan={BUDGET_IMPORT_COLUMNS.findIndex((c) => c.key === "total_cost")}
                >
                  {t.common.total}
                </td>
                <td className="px-3 py-2 text-right">
                  {totalCost.toLocaleString("fr-FR")}
                </td>
                <td
                  className="px-3 py-2"
                  colSpan={
                    BUDGET_IMPORT_COLUMNS.length -
                    BUDGET_IMPORT_COLUMNS.findIndex((c) => c.key === "total_cost") -
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
