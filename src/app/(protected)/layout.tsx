"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/saisie", label: "Saisie" },
  { href: "/grand-livre", label: "G-Livre" },
  { href: "/journal-auxiliaire", label: "J-Auxiliaire" },
  { href: "/balance", label: "Balance" },
];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { session, profile, project, loading, signOut } = useAuth();

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
      <header className="border-b border-slate-700 bg-slate-900/60 px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-emerald-400">FIMS</span>
            <span className="text-sm text-slate-400">
              {profile
                ? `Bienvenue, ${profile.nom_utilisateur} | Rôle : ${profile.role}`
                : ""}
              {project ? ` | Projet : ${project.nom_projet} (${project.code_projet})` : ""}
            </span>
          </div>
          <button
            onClick={() => signOut()}
            className="rounded-md border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
          >
            Déconnexion
          </button>
        </div>
        <nav className="mx-auto mt-3 flex max-w-6xl flex-wrap gap-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
