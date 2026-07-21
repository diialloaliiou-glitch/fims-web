"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { fieldControlClass } from "@/components/ui/FormField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { soldesEnAttente, type SoldeEnAttente } from "@/lib/soldes-attente";
import {
  getModeleProps,
  journauxPour,
  modelesPour,
  typesOperationDisponibles,
} from "@/lib/modeles-ecriture";
import type { ChartOfAccount, Project, ThirdParty, Zone } from "@/lib/types";

type LigneGeneree = {
  compte: string;
  sens: "debit" | "credit";
  libelle: string;
  montant: number;
  tiers?: string;
  nPieceOverride?: string;
};

export type ResultatModele = {
  typeOperation: string;
  journal: string;
  bSLine: string;
  zoneId: string;
  tiers: string;
  refFactD: string;
  nChequeOv: string;
  nPiece: string;
  lignes: LigneGeneree[];
};

export function ModelesEcritureModal({
  open,
  onClose,
  project,
  accounts,
  thirdParties,
  zones,
  budgetLines,
  onGenerer,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  accounts: ChartOfAccount[];
  thirdParties: ThirdParty[];
  zones: Zone[];
  budgetLines: { our_line_code: string | null; description: string | null }[];
  onGenerer: (resultat: ResultatModele) => void;
}) {
  const { t } = useLanguage();

  const [step, setStep] = useState<"type" | "journal" | "modele" | "form">("type");
  const [typeOp, setTypeOp] = useState("");
  const [journal, setJournal] = useState("");
  const [modeleNom, setModeleNom] = useState("");

  const [compteDChoisi, setCompteDChoisi] = useState("");
  const [compteCChoisi, setCompteCChoisi] = useState("");
  const [montant, setMontant] = useState("");
  const [libelle, setLibelle] = useState("");
  const [bsl, setBsl] = useState("");
  const [refFactD, setRefFactD] = useState("");
  const [refReel, setRefReel] = useState("");
  const [tiersVal, setTiersVal] = useState("");
  const [zoneVal, setZoneVal] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [soldes, setSoldes] = useState<SoldeEnAttente[]>([]);
  const [loadingSoldes, setLoadingSoldes] = useState(false);
  const [pieceForcee, setPieceForcee] = useState<string | null>(null);
  const [soldesCoches, setSoldesCoches] = useState<Set<string>>(new Set());

  const props = modeleNom ? getModeleProps(modeleNom) : null;

  function resetTout() {
    setStep("type");
    setTypeOp("");
    setJournal("");
    setModeleNom("");
    resetFormulaire();
  }

  function resetFormulaire() {
    setCompteDChoisi("");
    setCompteCChoisi("");
    setMontant("");
    setLibelle("");
    setBsl("");
    setRefFactD("");
    setRefReel("");
    setTiersVal("");
    setZoneVal("");
    setError(null);
    setPieceForcee(null);
    setSoldesCoches(new Set());
  }

  useEffect(() => {
    if (step !== "form" || !props?.avecSoldes) return;
    setLoadingSoldes(true);
    soldesEnAttente(project).then((s) => {
      setSoldes(s);
      setLoadingSoldes(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, modeleNom]);

  if (!open) return null;

  function fermer() {
    resetTout();
    onClose();
  }

  function choisirType(v: string) {
    setTypeOp(v);
    setStep("journal");
  }

  function choisirJournal(v: string) {
    setJournal(v);
    setStep("modele");
  }

  function choisirModele(nom: string) {
    setModeleNom(nom);
    resetFormulaire();
    setStep("form");
  }

  const compteDResolved = props?.debit?.fixe ?? compteDChoisi;
  const compteCResolved = props?.credit?.fixe ?? compteCChoisi;

  const compteDPorteur = accounts.find((a) => a.ccompte === compteDResolved)?.compte_tiers === true;
  const compteCPorteur = accounts.find((a) => a.ccompte === compteCResolved)?.compte_tiers === true;
  const compteTiersActif = compteDPorteur ? compteDResolved : compteCPorteur ? compteCResolved : null;
  const tiersOptions = compteTiersActif
    ? thirdParties.filter((tp) => tp.compte_classe_4 === compteTiersActif)
    : [];

  const bslOptions = budgetLines.filter(
    (b) => b.our_line_code && b.our_line_code.toUpperCase() !== "52B" && b.our_line_code !== "-"
  );

  const multiSelect = !!props?.multiSelect;
  const nbCoches = soldesCoches.size;

  function libelleSolde(s: SoldeEnAttente) {
    return s.libelle
      ? `${t.saisie.reglement} ${s.numPiece} (${s.libelle})`
      : `${t.saisie.reglement} ${s.numPiece} ${s.tiers}`;
  }

  function prefillDepuisSolde(s: SoldeEnAttente) {
    setMontant(String(Math.abs(s.soldeNet)));
    if (s.bsl) setBsl(s.bsl);
    if (s.zoneId != null) setZoneVal(String(s.zoneId));
    if (s.refChq) setRefReel(s.refChq);
    if (!libelle.trim()) setLibelle(libelleSolde(s));
    if (s.tiers) setTiersVal(s.tiers);
    // Si le compte du solde correspond a une des options "choix" du debit
    // ou du credit de ce modele, on la selectionne automatiquement.
    if (props?.debit?.choix?.some((c) => c.code === s.compte)) setCompteDChoisi(s.compte);
    if (props?.credit?.choix?.some((c) => c.code === s.compte)) setCompteCChoisi(s.compte);
    setPieceForcee(s.numPiece);
  }

  function cliquerSolde(s: SoldeEnAttente) {
    const key = `${s.compte}|${s.numPiece}`;
    if (multiSelect) {
      const next = new Set(soldesCoches);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setSoldesCoches(next);
      if (next.size === 1) {
        const only = soldes.find((x) => `${x.compte}|${x.numPiece}` === Array.from(next)[0]);
        if (only) prefillDepuisSolde(only);
      } else if (next.size > 1) {
        const total = Array.from(next).reduce((sum, k) => {
          const found = soldes.find((x) => `${x.compte}|${x.numPiece}` === k);
          return sum + (found ? Math.abs(found.soldeNet) : 0);
        }, 0);
        setMontant(String(total));
        setPieceForcee(null);
      }
    } else {
      prefillDepuisSolde(s);
    }
  }

  function handleGenerer() {
    setError(null);
    if (!props) return;

    if (props.bslVisible && !bsl.trim()) {
      setError(t.saisie.modeles.erreurBslObligatoire);
      return;
    }
    if (!refFactD.trim()) {
      setError(t.saisie.modeles.erreurRefObligatoire);
      return;
    }
    if ((journal === "BQ" || journal === "CS") && !refReel.trim()) {
      setError(t.saisie.modeles.erreurRefReelleObligatoire);
      return;
    }
    if (compteTiersActif && !tiersVal.trim()) {
      setError(t.saisie.modeles.erreurTiersObligatoire);
      return;
    }

    if (multiSelect && nbCoches > 1) {
      if (!compteCResolved.trim()) {
        setError(t.saisie.modeles.erreurCompteCreditObligatoire);
        return;
      }
      const selectionnees = soldes.filter((s) => soldesCoches.has(`${s.compte}|${s.numPiece}`));
      const lignesDebit: LigneGeneree[] = selectionnees.map((s) => ({
        compte: s.compte,
        sens: "debit",
        libelle: libelleSolde(s),
        montant: Math.abs(s.soldeNet),
        tiers: s.tiers || undefined,
        nPieceOverride: s.numPiece,
      }));
      const total = lignesDebit.reduce((sum, l) => sum + l.montant, 0);

      onGenerer({
        typeOperation: typeOp,
        journal,
        bSLine: bsl,
        zoneId: zoneVal,
        tiers: "",
        refFactD,
        nChequeOv: refReel,
        nPiece: "",
        lignes: [
          ...lignesDebit,
          {
            compte: compteCResolved,
            sens: "credit",
            libelle: libelle.trim() || t.saisie.reglement,
            montant: total,
            nPieceOverride: "-",
          },
        ],
      });
      fermer();
      return;
    }

    const montantNum = parseFloat(montant);
    if (!montantNum || montantNum <= 0) {
      setError(t.saisie.erreurMontantPositif);
      return;
    }
    if (!compteDResolved.trim() || !compteCResolved.trim()) {
      setError(t.saisie.modeles.erreurComptesObligatoires);
      return;
    }

    onGenerer({
      typeOperation: typeOp,
      journal,
      bSLine: bsl,
      zoneId: zoneVal,
      tiers: tiersVal,
      refFactD,
      nChequeOv: refReel,
      nPiece: pieceForcee ?? "",
      lignes: [
        {
          compte: compteDResolved,
          sens: "debit",
          libelle: libelle.trim() || modeleNom,
          montant: montantNum,
        },
        {
          compte: compteCResolved,
          sens: "credit",
          libelle: libelle.trim() || modeleNom,
          montant: montantNum,
        },
      ],
    });
    fermer();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border-subtle bg-bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-semibold text-text-primary">{t.saisie.modeles.titre}</p>
          <button onClick={fermer} aria-label={t.common.annuler}>
            <X className="h-5 w-5 text-text-secondary hover:text-text-primary" />
          </button>
        </div>

        {step === "type" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {typesOperationDisponibles().map((v) => (
              <button
                key={v}
                onClick={() => choisirType(v)}
                className="rounded-lg border border-border-subtle bg-bg-card-muted px-4 py-3 text-sm font-medium text-text-primary hover:border-accent-teal"
              >
                {v}
              </button>
            ))}
          </div>
        )}

        {step === "journal" && (
          <div>
            <button
              onClick={() => setStep("type")}
              className="mb-4 text-sm text-accent-blue hover:underline"
            >
              {t.saisie.modeles.retour}
            </button>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {journauxPour(typeOp).map((j) => (
                <button
                  key={j}
                  onClick={() => choisirJournal(j)}
                  className="rounded-lg border border-border-subtle bg-bg-card-muted px-4 py-3 text-sm font-medium text-text-primary hover:border-accent-teal"
                >
                  {j}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "modele" && (
          <div>
            <button
              onClick={() => setStep("journal")}
              className="mb-4 text-sm text-accent-blue hover:underline"
            >
              {t.saisie.modeles.retour}
            </button>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {modelesPour(typeOp, journal).map((m) => (
                <button
                  key={m}
                  onClick={() => choisirModele(m)}
                  className="rounded-lg border border-border-subtle bg-bg-card-muted px-4 py-2.5 text-left text-sm text-text-primary hover:border-accent-teal"
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "form" && props && (
          <div>
            <button
              onClick={() => setStep("modele")}
              className="mb-4 text-sm text-accent-blue hover:underline"
            >
              {t.saisie.modeles.retour}
            </button>
            <p className="mb-4 text-sm font-medium text-text-secondary">{modeleNom}</p>

            {props.info ? (
              <p className="rounded-md bg-accent-amber/10 px-4 py-3 text-sm text-accent-amber">
                {props.info}
              </p>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                      {t.saisie.modeles.compteDebit}
                    </label>
                    {props.debit?.choix ? (
                      <select
                        value={compteDChoisi}
                        onChange={(e) => setCompteDChoisi(e.target.value)}
                        className={fieldControlClass}
                      >
                        <option value="">—</option>
                        {props.debit.choix.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} — {c.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="rounded-xl border border-border-subtle bg-bg-card-muted px-3 py-2 text-text-primary">
                        {props.debit?.fixe}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                      {t.saisie.modeles.compteCredit}
                    </label>
                    {props.credit?.choix ? (
                      <select
                        value={compteCChoisi}
                        onChange={(e) => setCompteCChoisi(e.target.value)}
                        className={fieldControlClass}
                      >
                        <option value="">—</option>
                        {props.credit.choix.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} — {c.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="rounded-xl border border-border-subtle bg-bg-card-muted px-3 py-2 text-text-primary">
                        {props.credit?.fixe}
                      </p>
                    )}
                  </div>
                </div>

                {props.avecSoldes && (
                  <div className="mb-4 rounded-lg border border-border-subtle p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      {loadingSoldes
                        ? t.common.chargement
                        : soldes.length === 0
                          ? t.saisie.modeles.aucunSolde
                          : multiSelect
                            ? t.saisie.modeles.soldesMultiInfo.replace("{n}", String(soldes.length))
                            : t.saisie.modeles.soldesInfo.replace("{n}", String(soldes.length))}
                    </p>
                    <div className="max-h-40 overflow-y-auto">
                      {soldes.map((s) => {
                        const key = `${s.compte}|${s.numPiece}`;
                        const actif = multiSelect
                          ? soldesCoches.has(key)
                          : pieceForcee === s.numPiece && montant === String(Math.abs(s.soldeNet));
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => cliquerSolde(s)}
                            className={`mb-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs ${
                              actif
                                ? "bg-accent-teal/15 text-accent-teal"
                                : "text-text-secondary hover:bg-bg-card-muted"
                            }`}
                          >
                            <span>
                              {multiSelect && (
                                <input type="checkbox" checked={actif} readOnly className="mr-2" />
                              )}
                              {s.compte} · {s.numPiece} · {s.tiers}
                            </span>
                            <span className="font-medium">
                              {Math.abs(s.soldeNet).toLocaleString("fr-FR")}{" "}
                              {s.soldeNet > 0 ? "D" : "C"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {nbCoches > 1 && (
                      <p className="mt-2 text-xs text-accent-teal">
                        {t.saisie.modeles.selectionMultiple.replace("{n}", String(nbCoches))}
                      </p>
                    )}
                    {pieceForcee && (
                      <p className="mt-2 text-xs text-accent-amber">
                        {t.saisie.modeles.pieceConservee.replace("{piece}", pieceForcee)}
                      </p>
                    )}
                  </div>
                )}

                <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                      {t.saisie.montant}
                      <span className="text-accent-amber"> *</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={montant}
                      disabled={nbCoches > 1}
                      onChange={(e) => setMontant(e.target.value)}
                      className={fieldControlClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                      {t.common.libelle}
                    </label>
                    <input
                      type="text"
                      value={libelle}
                      onChange={(e) => setLibelle(e.target.value)}
                      className={fieldControlClass}
                    />
                  </div>
                </div>

                {props.bslVisible && (
                  <div className="mb-4">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                      {t.saisie.bSLine}
                      <span className="text-accent-amber"> *</span>
                    </label>
                    <select
                      value={bsl}
                      onChange={(e) => setBsl(e.target.value)}
                      className={fieldControlClass}
                    >
                      <option value="">—</option>
                      {bslOptions.map((b) => (
                        <option key={b.our_line_code} value={b.our_line_code ?? ""}>
                          {b.our_line_code} — {b.description}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {compteTiersActif && (
                  <div className="mb-4">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                      {t.saisie.tiers}
                      <span className="text-accent-amber"> *</span>
                    </label>
                    <input
                      list="modeles-tiers-list"
                      type="text"
                      value={tiersVal}
                      onChange={(e) => setTiersVal(e.target.value)}
                      className={fieldControlClass}
                    />
                    <datalist id="modeles-tiers-list">
                      {tiersOptions.map((tp) => (
                        <option key={tp.id} value={tp.nom_tiers} />
                      ))}
                    </datalist>
                  </div>
                )}

                <div className="mb-4">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    {t.saisie.zone}
                  </label>
                  <select
                    value={zoneVal}
                    onChange={(e) => setZoneVal(e.target.value)}
                    className={fieldControlClass}
                  >
                    <option value="">—</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                      {t.saisie.refFactD}
                      <span className="text-accent-amber"> *</span>
                    </label>
                    <input
                      type="text"
                      value={refFactD}
                      onChange={(e) => setRefFactD(e.target.value)}
                      className={fieldControlClass}
                    />
                  </div>
                  {(journal === "BQ" || journal === "CS") && (
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        {t.saisie.nChqOv}
                        <span className="text-accent-amber"> *</span>
                      </label>
                      <input
                        type="text"
                        value={refReel}
                        onChange={(e) => setRefReel(e.target.value)}
                        className={fieldControlClass}
                      />
                    </div>
                  )}
                </div>

                {error && <p className="mb-3 text-sm text-accent-red">{error}</p>}

                <PrimaryButton onClick={handleGenerer}>{t.saisie.modeles.generer}</PrimaryButton>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
