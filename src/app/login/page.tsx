"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FormField } from "@/components/ui/FormField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useLanguage } from "@/lib/language-context";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
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
      setError(t.login.erreurIdentifiants);
      return;
    }

    router.push("/");
  }

  return (
    <div className="relative flex flex-1 items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-accent-teal">
            {t.login.titre}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">{t.login.sousTitre}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border-subtle bg-bg-card p-6 shadow-lg"
        >
          <div className="mb-4">
            <FormField
              label={t.login.email}
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <FormField
              label={t.login.motDePasse}
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="mb-4 text-sm text-accent-red">{error}</p>
          )}

          <PrimaryButton type="submit" disabled={loading} className="w-full">
            {loading ? t.login.connexion : t.login.seConnecter}
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
}
