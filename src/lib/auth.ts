import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "empresa" | "sponsor";

export interface AppProfile {
  id: string;
  role: AppRole;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useProfile() {
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, role, full_name, email, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      setProfile((data as AppProfile) ?? null);
      setLoading(false);
    })();
  }, [user, sessionLoading]);

  return { profile, user, loading: loading || sessionLoading };
}

export function dashboardPathFor(role: AppRole | null | undefined): string {
  if (role === "super_admin") return "/admin";
  if (role === "sponsor") return "/sponsor/dashboard";
  return "/empresa/dashboard";
}

export async function signOut() {
  await supabase.auth.signOut();
  if (typeof window !== "undefined") window.location.href = "/login";
}

export type { User };
