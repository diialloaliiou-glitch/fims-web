"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { House, Moon, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useLanguage } from "@/lib/language-context";
import { Pill } from "@/components/ui/Pill";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    session,
    profile,
    organization,
    projects,
    project,
    setActiveProjectId,
    loading,
    signOut,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    if (!loading && !session) {
      router.push("/login");
    }
  }, [loading, session, router]);

  useEffect(() => {
    if (!loading && session && !project) {
      router.push("/choisir-projet");
    }
  }, [loading, session, project, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-secondary">
        {t.common.chargement}
      </div>
    );
  }

  if (!session || !project) {
    return null;
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border-subtle bg-bg-card px-4 print:hidden">
        <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-card text-text-secondary hover:opacity-80"
              aria-label={t.common.retourDashboard}
            >
              <House className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <div className="max-w-[160px] truncate rounded-full bg-bg-card px-4 py-1.5 text-sm text-text-secondary sm:max-w-none">
              <span className="sm:hidden">{profile?.nom_utilisateur}</span>
              <span className="hidden sm:inline">
                {t.layout.bienvenue}, {profile?.nom_utilisateur} | {t.layout.role} : {profile?.role} |
                {" "}{t.layout.base} : {organization?.nom}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {projects.length > 1 && (
              <select
                value={project?.id ?? ""}
                onChange={(e) => setActiveProjectId(e.target.value)}
                className="max-w-[110px] truncate rounded-full border border-border-subtle bg-bg-card px-3 py-1.5 text-sm text-text-primary sm:max-w-[220px] lg:max-w-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code_projet} — {p.nom_projet}
                  </option>
                ))}
              </select>
            )}
            {projects.length === 1 && (
              <span className="hidden text-sm text-text-secondary sm:inline">
                {t.layout.projet} : {project?.code_projet}
              </span>
            )}
            {pathname !== "/" && (
              <Link
                href="/"
                className="text-sm text-text-secondary hover:text-accent-teal"
              >
                {t.common.voirDashboard}
              </Link>
            )}
            <LanguageSwitcher />
            <button
              onClick={toggleTheme}
              aria-label={t.common.changerTheme}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle text-text-secondary hover:bg-bg-card"
            >
              {theme === "dark" ? (
                <Moon className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Sun className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
            <Pill onClick={() => signOut()}>{t.common.deconnexion}</Pill>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
