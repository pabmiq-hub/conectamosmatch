import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/dashboard/StatCard";
import { Building2, Sparkles, Heart, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [s, setS] = useState({ empresas: 0, sponsors: 0, matches: 0, events: 0 });
  useEffect(() => {
    (async () => {
      const [e, sp, m, ev] = await Promise.all([
        supabase.from("empresa_profiles").select("*", { count: "exact", head: true }),
        supabase.from("sponsor_profiles").select("*", { count: "exact", head: true }),
        supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "mutual"),
        supabase.from("events").select("*", { count: "exact", head: true }).in("status", ["published","ongoing"]),
      ]);
      setS({ empresas: e.count ?? 0, sponsors: sp.count ?? 0, matches: m.count ?? 0, events: ev.count ?? 0 });
    })();
  }, []);
  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold text-uppercase-wide">Panel de administración</h1>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Building2} value={s.empresas} label="Empresas registradas" accent to="/admin/usuarios" />
        <StatCard icon={Sparkles} value={s.sponsors} label="Soluciones registradas" accent to="/admin/usuarios" />
        <StatCard icon={Heart} value={s.matches} label="Matches mutuos" accent to="/admin/matches" />
        <StatCard icon={Calendar} value={s.events} label="Próximos eventos" accent to="/admin/eventos" />
      </div>
    </div>
  );
}
