"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError("Email ou mot de passe incorrect.");
      return;
    }

    router.push("/");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-accent-green">
            FIMS
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Financial Information Management System
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border-default bg-surface-1 p-6 shadow-lg"
        >
          <div className="mb-4">
            <label className="mb-1 block text-sm text-fg-secondary">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary outline-none focus:border-accent-green"
              autoComplete="email"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm text-fg-secondary">
              Mot de passe
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-2 px-3 py-2 text-fg-primary outline-none focus:border-accent-green"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="mb-4 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent-green py-2 font-medium text-on-accent transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
