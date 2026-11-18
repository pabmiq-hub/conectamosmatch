import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/dashboard/StatCard";
import { Building2, Sparkles, Heart, Calendar } from "lucide-react";
import { AdminEventSelector, useAdminEvent } from "@/hooks/use-admin-event";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Panel de administración · Conectamos" }, { name: "description", content: "Métricas del evento activo para el superadministrador." }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { eventId, ready } = useAdminEvent();
  const [s, setS] = useState({ empresas: 0, sponsors: 0, matches: 0, meetings: 0 });
  useEffect(() => {
    if (!ready) return;
    (async () => {
      const m = supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "mutual");
      const mt = supabase.from("meetings_1to1").select("*", { count: "exact", head: true }).not("scheduled_time", "is", null).neq("status", "cancelled");
      if (eventId) {
        const [regs, mc, mtc] = await Promise.all([
          supabase.from("event_registrations").select("user_id, role_at_event").eq("event_id", eventId).neq("status", "cancelled"),
          m.eq("event_id", eventId),
          mt.eq("event_id", eventId),
        ]);
        const rows = regs.data ?? [];
        const ids = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))] as string[];
        let emp = 0, sp = 0;
        if (ids.length) {
          const [e, p] = await Promise.all([
            supabase.from("empresa_profiles").select("id", { count: "exact", head: true }).in("user_id", ids),
            supabase.from("sponsor_profiles").select("id", { count: "exact", head: true }).in("user_id", ids),
          ]);
          emp = e.count ?? 0; sp = p.count ?? 0;
        }
        setS({ empresas: emp, sponsors: sp, matches: mc.count ?? 0, meetings: mtc.count ?? 0 });
      } else {
        const [e, sp, mc, mtc] = await Promise.all([
          supabase.from("empresa_profiles").select("*", { count: "exact", head: true }),
          supabase.from("sponsor_profiles").select("*", { count: "exact", head: true }),
          m, mt,
        ]);
        setS({ empresas: e.count ?? 0, sponsors: sp.count ?? 0, matches: mc.count ?? 0, meetings: mtc.count ?? 0 });
      }
    })();
  }, [eventId, ready]);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold text-uppercase-wide">Panel de administración</h1>
        <AdminEventSelector />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Building2} value={s.empresas} label={eventId ? "Empresas inscritas" : "Empresas registradas"} accent to="/admin/usuarios" />
        <StatCard icon={Sparkles} value={s.sponsors} label={eventId ? "Soluciones inscritas" : "Soluciones registradas"} accent to="/admin/usuarios" />
        <StatCard icon={Heart} value={s.matches} label="Matches mutuos" accent to="/admin/matches" />
        <StatCard icon={Calendar} value={s.meetings} label="Reuniones agendadas" accent to="/admin/reuniones" />
      </div>
    </div>
  );
}
