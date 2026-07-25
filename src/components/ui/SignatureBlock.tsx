"use client";

import { useLanguage } from "@/lib/language-context";
import type { Project } from "@/lib/types";

// Reproduit le bloc de signature identique retrouve en bas des feuilles
// J-AUXILIAIRE, GRAND LIVRE, BALANCE, REPORTING, FINANCIAL REPORT et ERB
// du FIMS Excel d'origine (memes 3 roles, meme structure Full name /
// Signature / Date sur chacune).
export function SignatureBlock({ project }: { project: Project | null }) {
  const { t } = useLanguage();

  const signataires = [
    { role: t.signatureBlock.preparedByFinance, nom: project?.administrative_financial_manager },
    { role: t.signatureBlock.reviewedByRaf, nom: project?.reviewed_by },
    { role: t.signatureBlock.approvedByCoordinator, nom: project?.program_coordinator_president },
  ];

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-border-subtle bg-bg-card p-4 text-sm sm:grid-cols-3">
      {signataires.map((s) => (
        <div key={s.role} className="flex flex-col">
          <p className="font-semibold text-text-primary">{s.role}</p>
          <p className="mt-2 text-xs text-text-secondary">{t.signatureBlock.fullName}</p>
          <p className="text-text-primary">{s.nom || "—"}</p>
          <div className="mt-8 border-t border-border-subtle pt-1 text-xs text-text-secondary">
            {t.signatureBlock.signature}
          </div>
          <p className="mt-4 text-xs text-text-secondary">
            {t.signatureBlock.date} : __ / __ / ____
          </p>
        </div>
      ))}
    </div>
  );
}
