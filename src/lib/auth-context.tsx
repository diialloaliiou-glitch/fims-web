"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile, Project, Organization } from "./types";

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  project: Project | null;
  organization: Organization | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  project: null,
  organization: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfileAndProject(userId: string) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileData) {
      setProfile(profileData as Profile);

      const [{ data: projectData }, { data: orgData }] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .eq("organization_id", profileData.organization_id)
          .eq("actif", true)
          .limit(1)
          .single(),
        supabase
          .from("organizations")
          .select("*")
          .eq("id", profileData.organization_id)
          .single(),
      ]);

      setProject((projectData as Project) ?? null);
      setOrganization((orgData as Organization) ?? null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        await loadProfileAndProject(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await loadProfileAndProject(session.user.id);
      } else {
        setProfile(null);
        setProject(null);
        setOrganization(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, project, organization, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
