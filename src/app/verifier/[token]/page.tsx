"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { verifierPiece, type PieceVerifiee } from "@/lib/verification-piece";

export default function VerifierPage() {
  const params = useParams<{ token: string }>();
  const { t } = useLanguage();
  const [piece, setPiece] = useState<PieceVerifiee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verifierPiece(params.token).then((p) => {
      setPiece(p);
      setLoading(false);
    });
  }, [params.token]);

  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-bg-card p-6 text-center shadow-lg">
        {loading ? (
          <p className="text-text-secondary">{t.common.chargement}</p>
        ) : piece ? (
          <>
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-accent-teal" strokeWidth={1.5} />
            <p className="mb-4 font-semibold text-accent-teal">{t.verifier.authentique}</p>
            <div className="space-y-2 text-left text-sm">
              <p>
                <span className="text-text-secondary">{t.verifier.nPiece} </span>
                <span className="font-medium text-text-primary">{piece.n_piece}</span>
              </p>
              <p>
                <span className="text-text-secondary">{t.verifier.projet} </span>
                <span className="font-medium text-text-primary">{piece.projet}</span>
              </p>
              <p>
                <span className="text-text-secondary">{t.verifier.date} </span>
                <span className="font-medium text-text-primary">
                  {new Date(piece.date_operation).toLocaleDateString("fr-FR")}
                </span>
              </p>
              <p>
                <span className="text-text-secondary">{t.verifier.tiers} </span>
                <span className="font-medium text-text-primary">{piece.tiers}</span>
              </p>
              <p>
                <span className="text-text-secondary">{t.verifier.montant} </span>
                <span className="font-medium text-text-primary">
                  {piece.montant.toLocaleString("fr-FR")}
                </span>
              </p>
            </div>
          </>
        ) : (
          <>
            <XCircle className="mx-auto mb-3 h-12 w-12 text-accent-red" strokeWidth={1.5} />
            <p className="font-semibold text-accent-red">{t.verifier.introuvable}</p>
          </>
        )}
      </div>
    </div>
  );
}
