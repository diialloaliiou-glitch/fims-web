"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { hasRole } from "@/lib/roles";
import {
  budgetTotalAnnuel,
  chargerDonneesKpi,
  consommationMensuelleCumulee,
  fondsRecusEtCourbe,
  repartitionParRegion,
  resultatParDimension,
  rythmeLineaireIdeal,
  statutTauxKpi,
  type FondsRecusResultat,
  type LigneDepenseKpi,
  type ProjetKpi,
  type ResultatDimension,
  type ResultatRegion,
} from "@/lib/kpi-organisation";
import type { BudgetLine, Zone } from "@/lib/types";

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const COULEURS_PROJETS = ["#34E0B0", "#5B9BF5", "#F0A93B", "#E5484D", "#A78BFA", "#F472B6"];

// Tailwind analyse le code source de façon statique : une classe construite
// par interpolation (`text-accent-${couleur}`) ne serait jamais generee -
// on passe donc toujours par ces classes completes et litterales.
const COULEUR_CLASSES: Record<"teal" | "amber" | "red", { texte: string; fond: string }> = {
  teal: { texte: "text-accent-teal", fond: "bg-accent-teal" },
  amber: { texte: "text-accent-amber", fond: "bg-accent-amber" },
  red: { texte: "text-accent-red", fond: "bg-accent-red" },
};

function formatM(n: number) {
  return `${Math.round(n / 1000000).toLocaleString("fr-FR")} M`;
}

function construirePoints(valeurs: number[], max: number) {
  const largeur = 560;
  const hauteur = 190;
  const padX = 18;
  const padY = 14;
  const largeurUtile = largeur - 2 * padX;
  const hauteurUtile = hauteur - 2 * padY;
  const pas = valeurs.length > 1 ? largeurUtile / (valeurs.length - 1) : 0;
  return valeurs.map((v, i) => ({
    x: +(padX + i * pas).toFixed(1),
    y: +(padY + hauteurUtile - (max > 0 ? (v / max) * hauteurUtile : 0)).toFixed(1),
    valeur: v,
  }));
}

function pointsVersAttr(points: { x: number; y: number }[]) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

const LIGNES_GRILLE = [0.25, 0.5, 0.75, 1].map((f) => 14 + (190 - 28) * (1 - f));

function CourbeSvg({
  series,
}: {
  series: { valeurs: number[]; couleur: string; pointille?: boolean }[];
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.valeurs));
  return (
    <svg viewBox="0 0 560 190" className="h-[190px] w-full overflow-visible">
      {LIGNES_GRILLE.map((y, i) => (
        <line key={i} x1={18} x2={542} y1={y} y2={y} className="stroke-border-subtle" strokeWidth={1} />
      ))}
      {series.map((s, si) => {
        const points = construirePoints(s.valeurs, max);
        return (
          <g key={si}>
            <polyline
              points={pointsVersAttr(points)}
              fill="none"
              stroke={s.couleur}
              strokeWidth={2.5}
              strokeDasharray={s.pointille ? "6,5" : undefined}
            />
            {!s.pointille &&
              points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={s.couleur} stroke="var(--bg-base)" strokeWidth={1.5}>
                  <title>{`${MOIS[i]} : ${formatM(p.valeur)} FCFA`}</title>
                </circle>
              ))}
          </g>
        );
      })}
    </svg>
  );
}

function BarreDivergente({ valeur, max, couleurPositif, couleurNegatif }: { valeur: number; max: number; couleurPositif: string; couleurNegatif: string }) {
  const positif = valeur >= 0;
  const demiLargeur = max > 0 ? (Math.abs(valeur) / max) * 50 : 0;
  return (
    <div className="relative h-3 flex-1 rounded-md bg-bg-card-muted">
      <div
        className="absolute top-0 bottom-0 rounded-sm"
        style={{
          left: positif ? "50%" : `${50 - demiLargeur}%`,
          width: `${demiLargeur}%`,
          background: positif ? couleurPositif : couleurNegatif,
        }}
      />
    </div>
  );
}

export default function KpiOrganisationnelPage() {
  const { profile, organization, projects: projetsAssignes } = useAuth();
  const { t } = useLanguage();

  const peutVoir = hasRole(profile?.role, ["ADMIN_N1", "ADMIN_SITE", "RAF"]);

  const [allProjects, setAllProjects] = useState<ProjetKpi[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [zones, setZones] = useState<Zone[]>([]);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [lignes, setLignes] = useState<LigneDepenseKpi[]>([]);
  const [fondsRecus, setFondsRecus] = useState<FondsRecusResultat | null>(null);
  const [loading, setLoading] = useState(true);
  const [modeReception, setModeReception] = useState<"mensuel" | "cumule">("cumule");

  useEffect(() => {
    if (!organization) return;
    supabase
      .from("projects")
      .select("id, code_projet, nom_projet, organization_id, compte_reception_fonds")
      .eq("organization_id", organization.id)
      .eq("actif", true)
      .order("nom_projet")
      .then(({ data }) => {
        const liste = (data as ProjetKpi[]) ?? [];
        setAllProjects(liste);
        setSelectedIds(new Set(liste.map((p) => p.id)));
      });
    supabase
      .from("zones")
      .select("*")
      .eq("organization_id", organization.id)
      .then(({ data }) => setZones((data as Zone[]) ?? []));
  }, [organization]);

  const projetsInclus = useMemo(
    () => allProjects.filter((p) => selectedIds.has(p.id)),
    [allProjects, selectedIds]
  );

  useEffect(() => {
    if (projetsInclus.length === 0) {
      setBudgetLines([]);
      setLignes([]);
      setFondsRecus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([chargerDonneesKpi(projetsInclus, annee), fondsRecusEtCourbe(projetsInclus, annee)]).then(
      ([donnees, recus]) => {
        setBudgetLines(donnees.budgetLines);
        setLignes(donnees.lignes);
        setFondsRecus(recus);
        setLoading(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetsInclus, annee]);

  const anneeCourante = new Date().getFullYear();
  const anneeMin = allProjects.reduce((min, p) => {
    const proj = projetsAssignes.find((pp) => pp.id === p.id);
    const debut = proj?.date_debut_projet ? parseInt(proj.date_debut_projet.slice(0, 4), 10) : anneeCourante;
    return Math.min(min, debut);
  }, anneeCourante);
  const anneesDisponibles = Array.from({ length: anneeCourante - anneeMin + 1 }, (_, i) => anneeMin + i);

  function toggleProjet(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalBudget = budgetTotalAnnuel(budgetLines);
  const depenseTotale = lignes.reduce((s, l) => s + l.montant, 0);
  const tauxConso = fondsRecus && fondsRecus.total > 0 ? depenseTotale / fondsRecus.total : null;
  const statutTaux = tauxConso != null ? statutTauxKpi(tauxConso) : null;

  const courbeConsommation = consommationMensuelleCumulee(lignes);
  const courbeIdeale = rythmeLineaireIdeal(totalBudget);

  const parMoisReception = fondsRecus?.parMois ?? Array.from({ length: 12 }, () => 0);
  const courbeReceptionCumulee = useMemo(() => {
    let cumul = 0;
    return parMoisReception.map((v) => (cumul += v));
  }, [parMoisReception]);
  const courbeReception = modeReception === "cumule" ? courbeReceptionCumulee : parMoisReception;

  const resultatSecteur: ResultatDimension[] = resultatParDimension(budgetLines, lignes, "secteur");
  const resultatCategorie: ResultatDimension[] = resultatParDimension(budgetLines, lignes, "categorie");
  const resultatRegion: ResultatRegion[] = repartitionParRegion(lignes, zones);

  const maxSecteur = Math.max(1, ...resultatSecteur.map((s) => Math.abs(s.resultat)));
  const maxCategorie = Math.max(1, ...resultatCategorie.map((c) => Math.abs(c.resultat)));
  const maxRegion = Math.max(1, ...resultatRegion.map((r) => r.montant));

  if (!peutVoir) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">{t.kpiOrganisationnel.titre}</h1>
        <p className="text-sm text-text-secondary">
          {t.kpiOrganisationnel.permissionInfo.replace("{role}", profile?.role ?? "")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary">{t.kpiOrganisationnel.titre}</h1>
      <p className="mb-6 mt-1 text-sm text-text-secondary">{t.kpiOrganisationnel.sousTitre}</p>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-text-secondary">{t.kpiOrganisationnel.projetsInclus}</span>
          {projetsInclus.map((p, i) => {
            const total = fondsRecus?.parProjet.find((r) => r.projectId === p.id)?.total ?? 0;
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-card px-3 py-1.5"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: COULEURS_PROJETS[i % COULEURS_PROJETS.length] }}
                />
                <span className="text-sm text-text-primary">{p.code_projet}</span>
                <span className="text-xs text-text-secondary">{formatM(total)} FCFA</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 rounded-lg border border-border-subtle bg-bg-card p-1">
          {anneesDisponibles.map((a) => (
            <button
              key={a}
              onClick={() => setAnnee(a)}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
                a === annee ? "bg-bg-card-teal text-accent-teal" : "text-text-secondary"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border-subtle bg-bg-card p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          {t.kpiOrganisationnel.filtrerProjets}
        </p>
        <div className="flex flex-wrap gap-4">
          {allProjects.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm text-text-primary">
              <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleProjet(p.id)} />
              {p.code_projet}
            </label>
          ))}
        </div>
      </div>

      {fondsRecus && fondsRecus.projetsSansCompte.length > 0 && (
        <p className="mb-6 text-sm text-accent-amber">
          {t.kpiOrganisationnel.avertissementCompteManquant.replace(
            "{projets}",
            fondsRecus.projetsSansCompte.map((p) => p.code_projet).join(", ")
          )}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-text-secondary">{t.common.chargement}</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border-subtle bg-bg-card p-6">
              <p className="mb-4 text-sm text-text-secondary">
                {t.kpiOrganisationnel.fondsRecus.replace("{annee}", String(annee))}
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-extrabold text-accent-teal">
                  {(fondsRecus?.total ?? 0).toLocaleString("fr-FR")}
                </p>
                <p className="text-sm text-text-secondary">FCFA</p>
              </div>
              <div className="mt-5 flex h-2.5 overflow-hidden rounded-md bg-bg-card-muted">
                {projetsInclus.map((p, i) => {
                  const total = fondsRecus?.parProjet.find((r) => r.projectId === p.id)?.total ?? 0;
                  const pct = fondsRecus && fondsRecus.total > 0 ? (total / fondsRecus.total) * 100 : 0;
                  return (
                    <div
                      key={p.id}
                      style={{ width: `${pct}%`, background: COULEURS_PROJETS[i % COULEURS_PROJETS.length] }}
                    />
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                {projetsInclus.map((p, i) => {
                  const total = fondsRecus?.parProjet.find((r) => r.projectId === p.id)?.total ?? 0;
                  return (
                    <div key={p.id} className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: COULEURS_PROJETS[i % COULEURS_PROJETS.length] }}
                      />
                      {p.code_projet} · {formatM(total)} FCFA
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-bg-card p-6">
              <p className="mb-4 text-sm text-text-secondary">{t.kpiOrganisationnel.tauxConsoGlobal}</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-4xl font-extrabold ${COULEUR_CLASSES[statutTaux?.color ?? "teal"].texte}`}>
                  {tauxConso != null ? `${(tauxConso * 100).toFixed(1)}%` : "—"}
                </p>
                {statutTaux && (
                  <p className={`text-sm font-semibold ${COULEUR_CLASSES[statutTaux.color].texte}`}>
                    {statutTaux.label}
                  </p>
                )}
              </div>
              <div className="mt-5 h-2.5 overflow-hidden rounded-md bg-bg-card-muted">
                <div
                  className={`h-full rounded-md ${COULEUR_CLASSES[statutTaux?.color ?? "teal"].fond}`}
                  style={{ width: `${Math.min(100, (tauxConso ?? 0) * 100)}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-teal" />
                  {t.kpiOrganisationnel.legendeSain}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-amber" />
                  {t.kpiOrganisationnel.legendeSurveiller}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-red" />
                  {t.kpiOrganisationnel.legendeCritique}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border-subtle bg-bg-card p-6">
              <p className="text-base font-semibold text-text-primary">
                {t.kpiOrganisationnel.consommationCumulee}
              </p>
              <p className="mb-4 mt-1 text-xs text-text-secondary">
                {t.kpiOrganisationnel.consommationCumuleeSousTitre.replace("{annee}", String(annee))}
              </p>
              <CourbeSvg
                series={[
                  { valeurs: courbeIdeale, couleur: "#54607A", pointille: true },
                  { valeurs: courbeConsommation, couleur: "#34E0B0" },
                ]}
              />
              <div className="mt-1 flex justify-between px-4">
                {MOIS.map((m) => (
                  <span key={m} className="text-[10px] text-text-secondary">
                    {m}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="h-0.5 w-3.5 rounded bg-accent-teal" />
                  {t.kpiOrganisationnel.legendeConsoReelle}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="h-0 w-3.5 border-t-2 border-dashed" style={{ borderColor: "#54607A" }} />
                  {t.kpiOrganisationnel.legendeRythmeIdeal}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-text-primary">
                    {t.kpiOrganisationnel.receptionFonds}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {(modeReception === "cumule"
                      ? t.kpiOrganisationnel.receptionFondsSousTitreCumule
                      : t.kpiOrganisationnel.receptionFondsSousTitreMensuel
                    ).replace("{annee}", String(annee))}
                  </p>
                </div>
                <div className="flex gap-1 rounded-lg border border-border-subtle bg-bg-card-muted p-1">
                  <button
                    onClick={() => setModeReception("mensuel")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold ${
                      modeReception === "mensuel" ? "bg-bg-card-teal text-accent-blue" : "text-text-secondary"
                    }`}
                  >
                    {t.kpiOrganisationnel.mensuel}
                  </button>
                  <button
                    onClick={() => setModeReception("cumule")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold ${
                      modeReception === "cumule" ? "bg-bg-card-teal text-accent-blue" : "text-text-secondary"
                    }`}
                  >
                    {t.kpiOrganisationnel.cumule}
                  </button>
                </div>
              </div>
              <div className="mt-2">
                <CourbeSvg series={[{ valeurs: courbeReception, couleur: "#5B9BF5" }]} />
              </div>
              <div className="mt-1 flex justify-between px-4">
                {MOIS.map((m) => (
                  <span key={m} className="text-[10px] text-text-secondary">
                    {m}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="h-0.5 w-3.5 rounded bg-accent-blue" />
                {modeReception === "cumule"
                  ? t.kpiOrganisationnel.legendeReceptionCumul
                  : t.kpiOrganisationnel.legendeReceptionMensuel}
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border-subtle bg-bg-card p-6">
              <p className="text-base font-semibold text-text-primary">{t.kpiOrganisationnel.resultatParSecteur}</p>
              <p className="mb-5 mt-1 text-xs text-text-secondary">
                {t.kpiOrganisationnel.resultatParSecteurSousTitre}
              </p>
              <div className="flex flex-col gap-4">
                {resultatSecteur.length === 0 && (
                  <p className="text-sm text-text-secondary">{t.kpiOrganisationnel.aucuneDonnee}</p>
                )}
                {resultatSecteur.map((s) => (
                  <div key={s.nom} className="flex items-center gap-4">
                    <div className="w-40 shrink-0">
                      <p className="text-sm text-text-primary">{s.nom}</p>
                      <p className="mt-0.5 text-[11px] text-text-secondary">
                        {s.nbProjets > 1
                          ? t.kpiOrganisationnel.projetsPlusieurs.replace("{n}", String(s.nbProjets))
                          : t.kpiOrganisationnel.projetsUn.replace("{n}", String(s.nbProjets))}
                      </p>
                    </div>
                    <BarreDivergente
                      valeur={s.resultat}
                      max={maxSecteur}
                      couleurPositif="var(--accent-teal)"
                      couleurNegatif="var(--accent-red)"
                    />
                    <p
                      className={`w-20 shrink-0 text-right text-sm font-bold ${
                        s.resultat >= 0 ? "text-accent-teal" : "text-accent-red"
                      }`}
                    >
                      {s.resultat >= 0 ? "+" : "−"}
                      {formatM(Math.abs(s.resultat))}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-bg-card p-6">
              <p className="text-base font-semibold text-text-primary">
                {t.kpiOrganisationnel.resultatParCategorie}
              </p>
              <p className="mb-5 mt-1 text-xs text-text-secondary">
                {t.kpiOrganisationnel.resultatParCategorieSousTitre}
              </p>
              <div className="flex flex-col gap-4">
                {resultatCategorie.length === 0 && (
                  <p className="text-sm text-text-secondary">{t.kpiOrganisationnel.aucuneDonnee}</p>
                )}
                {resultatCategorie.map((c) => (
                  <div key={c.nom} className="flex items-center gap-4">
                    <p className="w-40 shrink-0 text-sm text-text-primary">{c.nom}</p>
                    <BarreDivergente
                      valeur={c.resultat}
                      max={maxCategorie}
                      couleurPositif="var(--accent-teal)"
                      couleurNegatif="var(--accent-red)"
                    />
                    <p
                      className={`w-20 shrink-0 text-right text-sm font-bold ${
                        c.resultat >= 0 ? "text-accent-teal" : "text-accent-red"
                      }`}
                    >
                      {c.resultat >= 0 ? "+" : "−"}
                      {formatM(Math.abs(c.resultat))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-bg-card p-6">
            <p className="text-base font-semibold text-text-primary">{t.kpiOrganisationnel.resultatParRegion}</p>
            <p className="mb-5 mt-1 text-xs text-text-secondary">
              {t.kpiOrganisationnel.resultatParRegionSousTitre}
            </p>
            <div className="flex flex-col gap-3">
              {resultatRegion.length === 0 && (
                <p className="text-sm text-text-secondary">{t.kpiOrganisationnel.aucuneDonnee}</p>
              )}
              {resultatRegion.map((r, i) => (
                <div key={r.nom} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-text-secondary">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-primary">{r.nom}</span>
                      <span className="font-semibold text-text-primary">
                        {formatM(r.montant)} FCFA
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded bg-bg-card-muted">
                      <div
                        className="h-full rounded bg-accent-teal"
                        style={{ width: `${(r.montant / maxRegion) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-20 shrink-0 text-right text-[11px] text-text-secondary">
                    {r.nbProjets > 1
                      ? t.kpiOrganisationnel.projetsPlusieurs.replace("{n}", String(r.nbProjets))
                      : t.kpiOrganisationnel.projetsUn.replace("{n}", String(r.nbProjets))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
