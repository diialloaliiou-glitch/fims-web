import { supabase } from "@/lib/supabase";

// 52B est la ligne placeholder qui doit exister dans chaque base (vraie
// structure Excel : BUDGET LINE = "-", OUR LINE CODE = "52B") - elle
// identifie les mouvements de tresorerie lies au projet qui ne sont pas
// forcement des depenses budgetaires (c'est pour ca que BUD TRACKER et le
// Financial Report l'excluent explicitement de leurs calculs). Sans elle,
// ces mouvements n'ont nulle part ou s'accrocher dans le budget.
export async function assurerLigne52B(organizationId: string, projectId: string) {
  const { data: existing } = await supabase
    .from("budget_lines")
    .select("id")
    .eq("project_id", projectId)
    .eq("our_line_code", "52B")
    .maybeSingle();

  if (existing) return;

  await supabase.from("budget_lines").insert({
    organization_id: organizationId,
    project_id: projectId,
    code_1: "-",
    budget_line: "-",
    our_line_code: "52B",
    description: "-",
    total_cost: 0,
  });
}
