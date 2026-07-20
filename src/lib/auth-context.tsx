"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile, Project, Organization } from "./types";

const ACTIVE_PROJECT_KEY = "fims_active_project_id";
const PROJECT_CHOSEN_THIS_SESSION_KEY = "fims_project_chosen_this_session";

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  projects: Project[];
  project: Project | null;
  organization: Organization | null;
  loading: boolean;
  accountDisabled: boolean;
  signOut: () => Promise<void>;
  setActiveProjectId: (projectId: string) => void;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  projects: [],
  project: null,
  organization: null,
  loading: true,
  accountDisabled: false,
  signOut: async () => {},
  setActiveProjectId: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountDisabled, setAccountDisabled] = useState(false);

  function chooseActiveProject(list: Project[]) {
    if (list.length === 1) {
      setProject(list[0]);
      window.sessionStorage.setItem(PROJECT_CHOSEN_THIS_SESSION_KEY, "true");
      return;
    }

    if (list.length === 0) {
      setProject(null);
      return;
    }

    const chosenThisSession =
      window.sessionStorage.getItem(PROJECT_CHOSEN_THIS_SESSION_KEY) === "true";

    if (!chosenThisSession) {
      // Plusieurs projets autorisés : on force un choix explicite via
      // /choisir-projet plutôt que d'en présélectionner un silencieusement.
      setProject(null);
      return;
    }

    const savedId = window.localStorage.getItem(ACTIVE_PROJECT_KEY);
    const saved = list.find((p) => p.id === savedId);
    setProject(saved ?? list[0]);
  }

  async function loadProfileAndProjects(userId: string) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!profileData) return;

    if (!profileData.actif) {
      setAccountDisabled(true);
      setProfile(null);
      setProjects([]);
      setProject(null);
      return;
    }

    setAccountDisabled(false);
    setProfile(profileData as Profile);

    const [{ data: links }, { data: orgData }] = await Promise.all([
      supabase
        .from("profile_projects")
        .select("project_id")
        .eq("profile_id", userId),
      supabase
        .from("organizations")
        .select("*")
        .eq("id", profileData.organization_id)
        .single(),
    ]);

    setOrganization((orgData as Organization) ?? null);

    const projectIds = (links ?? []).map((l) => l.project_id);
    if (projectIds.length === 0) {
      setProjects([]);
      setProject(null);
      return;
    }

    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .in("id", projectIds)
      .eq("actif", true)
      .order("nom_projet");

    const list = (projectData as Project[]) ?? [];
    setProjects(list);
    chooseActiveProject(list);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        await loadProfileAndProjects(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await loadProfileAndProjects(session.user.id);
      } else {
        setProfile(null);
        setProjects([]);
        setProject(null);
        setOrganization(null);
        setAccountDisabled(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.sessionStorage.removeItem(PROJECT_CHOSEN_THIS_SESSION_KEY);
    window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
    setAccountDisabled(false);
  }

  function setActiveProjectId(projectId: string) {
    const found = projects.find((p) => p.id === projectId);
    if (!found) return;
    setProject(found);
    window.localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
    window.sessionStorage.setItem(PROJECT_CHOSEN_THIS_SESSION_KEY, "true");
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        projects,
        project,
        organization,
        loading,
        accountDisabled,
        signOut,
        setActiveProjectId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
