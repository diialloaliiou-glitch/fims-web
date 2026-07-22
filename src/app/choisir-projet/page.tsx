"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export default function ChoisirProjetPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const {
    session,
    profile,
    organization,
    projects,
    project,
    loading,
    accountDisabled,
    signOut,
    setActiveProjectId,
  } = useAuth();

  useEffect(() => {
    if (!loading && !session) {
      router.push("/login");
    }
  }, [loading, session, router]);

  useEffect(() => {
    if (!loading && session && project) {
      router.push("/");
    }
  }, [loading, session, project, router]);

  if (loading || !session || project) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-secondary">
        {t.common.chargement}
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-accent-teal">FIMS</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {profile?.nom_utilisateur} — {organization?.nom}
          </p>
        </div>

        <div className="rounded-xl border border-border-subtle bg-bg-card p-6 shadow-lg">
          {accountDisabled ? (
            <>
              <p className="mb-4 text-sm font-medium text-accent-red">
                {t.choisirProjet.compteDesactive}
              </p>
              <p className="mb-4 text-sm text-text-secondary">
                {t.choisirProjet.contacteAdmin}
              </p>
              <button
                onClick={() => signOut()}
                className="rounded-md border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:bg-bg-card"
              >
                {t.choisirProjet.seDeconnecter}
              </button>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm font-medium text-text-secondary">
                {t.choisirProjet.choisirProjetSurLequel}
              </p>

              {projects.length === 0 ? (
                <>
                  <p className="mb-4 text-sm text-text-secondary">
                    {t.choisirProjet.aucunProjet}
                  </p>
                  <button
                    onClick={() => signOut()}
                    className="rounded-md border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:bg-bg-card"
                  >
                    {t.choisirProjet.seDeconnecter}
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActiveProjectId(p.id)}
                      className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-card-muted px-4 py-3 text-left transition-colors hover:border-accent-teal"
                    >
                      <FolderKanban
                        className="h-5 w-5 shrink-0 text-accent-teal"
                        strokeWidth={1.75}
                      />
                      <span>
                        <span className="block font-semibold text-text-primary">
                          {p.code_projet}
                        </span>
                        <span className="block text-sm text-text-secondary">
                          {p.nom_projet}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
