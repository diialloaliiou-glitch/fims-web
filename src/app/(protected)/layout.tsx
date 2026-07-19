"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";

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

  useEffect(() => {
    if (!loading && !session) {
      router.push("/login");
    }
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-fg-muted">
        Chargement...
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border-default bg-surface-1/80 px-4 py-2 print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-fg-muted hover:opacity-80"
              aria-label="Retour au dashboard"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4zm0-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
              </svg>
            </Link>
            <div className="rounded-full bg-surface-2 px-4 py-1.5 text-sm text-fg-secondary">
              Bienvenue, {profile?.nom_utilisateur} | Rôle : {profile?.role} |
              {" "}Base : {organization?.nom}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {projects.length > 1 && (
              <select
                value={project?.id ?? ""}
                onChange={(e) => setActiveProjectId(e.target.value)}
                className="rounded-full border border-border-default bg-surface-2 px-3 py-1.5 text-sm text-fg-primary"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code_projet} — {p.nom_projet}
                  </option>
                ))}
              </select>
            )}
            {projects.length === 1 && (
              <span className="hidden text-sm text-fg-muted sm:inline">
                Projet : {project?.code_projet}
              </span>
            )}
            {pathname !== "/" && (
              <Link
                href="/"
                className="text-sm text-fg-muted hover:text-accent-green"
              >
                ← Dashboard
              </Link>
            )}
            <button
              onClick={toggleTheme}
              aria-label="Changer de thème"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border-default text-fg-secondary hover:bg-surface-2"
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.4 5.4 0 0 1-7.54-7.54c-.44-.06-.9-.1-1.36-.1Z" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  className="h-4 w-4"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              )}
            </button>
            <button
              onClick={() => signOut()}
              className="rounded-full border border-border-default px-4 py-1.5 text-sm text-fg-secondary hover:bg-surface-2"
            >
              ✕ Déconnexion
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
