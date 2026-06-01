import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dashboardPathFor, type AppRole, type AppProfile } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) {
        if (typeof window !== "undefined") window.location.href = "/login";
      }
    });

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (typeof window !== "undefined") window.location.href = "/login";
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("id, role, full_name, email, avatar_url")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!mounted) return;
      const prof = p as AppProfile | null;
      setProfile(prof);

      // path-based role enforcement
      const path = window.location.pathname;
      const role = (prof?.role ?? "empresa") as AppRole;
      const expected = role === "super_admin" ? "/admin" : role === "sponsor" ? "/sponsor" : "/empresa";
      if (!path.startsWith(expected)) {
        window.history.replaceState(null, "", dashboardPathFor(role));
      }

      // load company name
      if (role === "empresa") {
        const { data: e } = await supabase.from("empresa_profiles").select("company_name, logo_url").eq("user_id", session.user.id).maybeSingle();
        setCompanyName(e?.company_name ?? prof?.full_name ?? "Empresa");
        setLogoUrl(e?.logo_url ?? null);
      } else if (role === "sponsor") {
        const { data: s } = await supabase.from("sponsor_profiles").select("company_name, logo_url").eq("user_id", session.user.id).maybeSingle();
        setCompanyName(s?.company_name ?? prof?.full_name ?? "Solución");
        setLogoUrl(s?.logo_url ?? null);
      } else {
        setCompanyName("Super Admin");
        setLogoUrl(null);
      }
      setReady(true);
    })();

    return () => { mounted = false; sub.data.subscription.unsubscribe(); };
  }, []);

  if (!ready || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xs text-muted-foreground text-uppercase-wide">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar role={profile.role} companyName={companyName} logoUrl={logoUrl} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar userName={profile.full_name ?? profile.email} role={profile.role} companyName={companyName} logoUrl={logoUrl} title={profile.role === "super_admin" ? "Panel de administración" : ""} />
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
