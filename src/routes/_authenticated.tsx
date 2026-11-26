import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dashboardPathFor, type AppRole, type AppProfile } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { getMyActiveRetoEvent } from "@/lib/reto";
import { RetoEntryPopup } from "@/components/reto/RetoEntryPopup";
import { fetchMyEventScope } from "@/hooks/use-my-event";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

function AuthLayout() {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [retoActive, setRetoActive] = useState(false);
  const [retoEventId, setRetoEventId] = useState<string | null>(null);
  const [allowAvailability, setAllowAvailability] = useState(false);
  const [isAccountAdmin, setIsAccountAdmin] = useState(false);

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
        .select("id, role, full_name, email, avatar_url, account_role, account_id")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!mounted) return;
      const prof = p as AppProfile | null;
      setProfile(prof);
      setIsAccountAdmin((p as any)?.account_role === "owner");

      // path-based role enforcement
      const path = window.location.pathname;
      const role = (prof?.role ?? "empresa") as AppRole;
      const expected = role === "super_admin" ? "/admin" : role === "sponsor" ? "/sponsor" : "/empresa";
      if (!path.startsWith(expected)) {
        window.history.replaceState(null, "", dashboardPathFor(role));
      }

      // load company name
      if (role === "empresa") {
        const accId = (p as { account_id?: string | null } | null)?.account_id ?? null;
        const { data: e } = accId
          ? await supabase.from("empresa_profiles").select("company_name, logo_url").eq("id", accId).maybeSingle()
          : await supabase.from("empresa_profiles").select("company_name, logo_url").eq("user_id", session.user.id).maybeSingle();
        setCompanyName(e?.company_name ?? prof?.full_name ?? "Empresa");
        setLogoUrl(e?.logo_url ?? null);
      } else if (role === "sponsor") {
        const accId = (p as { account_id?: string | null } | null)?.account_id ?? null;
        const { data: s } = accId
          ? await supabase.from("sponsor_profiles").select("company_name, logo_url").eq("id", accId).maybeSingle()
          : await supabase.from("sponsor_profiles").select("company_name, logo_url").eq("user_id", session.user.id).maybeSingle();
        setCompanyName(s?.company_name ?? prof?.full_name ?? "Solución");
        setLogoUrl(s?.logo_url ?? null);
      } else {
        setCompanyName("Super Admin");
        setLogoUrl(null);
      }
      setReady(true);
      if (role !== "super_admin") {
        fetchMyEventScope().then((s) => { if (mounted) setAllowAvailability(!!s.event?.allow_participant_availability); }).catch(() => {});
        getMyActiveRetoEvent(session.user.id).then((ev) => { if (mounted) { setRetoActive(!!ev); setRetoEventId(ev); } }).catch(() => {});
      }
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
      <Sidebar role={profile.role} companyName={companyName} logoUrl={logoUrl} retoActive={retoActive} allowAvailability={allowAvailability} isAccountAdmin={isAccountAdmin} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar userName={profile.full_name ?? profile.email} role={profile.role} companyName={companyName} logoUrl={logoUrl} retoActive={retoActive} allowAvailability={allowAvailability} isAccountAdmin={isAccountAdmin} title={profile.role === "super_admin" ? "Panel de administración" : ""} />
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
        {retoEventId && profile.role !== "super_admin" && (
          <RetoEntryPopup eventId={retoEventId} role={profile.role === "sponsor" ? "sponsor" : "empresa"} />
        )}
      </div>
    </div>
  );
}
