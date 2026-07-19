"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile, organization, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !session) {
      router.push("/login");
    }
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-400">
        Chargement...
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-800 bg-slate-950/60 px-4 py-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700"
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
            <div className="rounded-full bg-slate-800/80 px-4 py-1.5 text-sm text-slate-300">
              Bienvenue, {profile?.nom_utilisateur} | Rôle : {profile?.role} |
              {" "}Base : {organization?.nom}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pathname !== "/" && (
              <Link
                href="/"
                className="text-sm text-slate-400 hover:text-emerald-400"
              >
                ← Dashboard
              </Link>
            )}
            <button
              onClick={() => signOut()}
              className="rounded-full border border-slate-600 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
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
