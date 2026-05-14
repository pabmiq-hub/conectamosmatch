import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/dashboard/StatCard";
import { AgendaTable } from "@/components/dashboard/AgendaTable";
import { LevelBadge } from "@/components/brand/LevelBadge";
import { Heart, Calendar, Search, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sponsor/dashboard")({
  component: SponsorDashboard,
});

function SponsorDashboard() {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<string>("BRONZE");
  const [agenda, setAgenda] = useState<any[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [stats, setStats] = useState({ matches: 0, meetings: 0 });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: sp } = await supabase.from("sponsor_profiles").select("company_name, sponsorship_level").eq("user_id", user.id).maybeSingle();
      setName(sp?.company_name ?? "");
      setLevel(sp?.sponsorship_level ?? "BRONZE");
      const { data: ev } = await supabase.from("events").select("id, title").in("status", ["published","ongoing"]).order("event_date").limit(1).maybeSingle();
      if (ev) {
        setEventTitle(ev.title);
        const { data: ag } = await supabase.from("event_agenda").select("*").eq("event_id", ev.id).order("order_index");
        setAgenda(ag ?? []);
      }
      const [m, mt, c, inv] = await Promise.all([
        supabase.from("matches").select("*", { count: "exact", head: true }).eq("sponsor_user_id", user.id).eq("status","mutual"),
        supabase.from("meetings_1to1").select("*", { count: "exact", head: true }).eq("sponsor_user_id", user.id),
        supabase.from("invitation_codes").select("*", { count: "exact", head: true }).eq("sponsor_user_id", user.id),
        supabase.from("event_registrations").select("invitation_code_id").not("invitation_code_id","is",null),
      ]);
      setStats({ matches: m.count ?? 0, meetings: mt.count ?? 0, codes: c.count ?? 0, invited: (inv.data ?? []).length });
    })();
  }, []);

  const isBronze = level === "BRONZE";
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-uppercase-wide">Bienvenido, {name}</h1>
          {eventTitle && <p className="mt-1 text-xs text-uppercase-wide text-muted-foreground">Evento actual: {eventTitle}</p>}
        </div>
        <LevelBadge level={level} />
      </div>

      {isBronze && (
        <div className="rounded-xl border border-bronze/40 bg-bronze/10 p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-foreground shrink-0" />
          <div className="text-xs">
            <div className="font-bold text-uppercase-wide">Nivel BRONZE</div>
            <div className="mt-1 text-muted-foreground">Algunas funciones premium (charla magistral, stand premium, mesas redondas) están reservadas para SILVER y superiores. Contacta con el organizador para subir de nivel.</div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Heart} value={stats.matches} label="Matches mutuos" accent />
        <StatCard icon={Calendar} value={stats.meetings} label="1to1 agendadas" accent />
        <StatCard icon={Ticket} value={stats.codes} label="Códigos creados" accent />
        <StatCard icon={UserCheck} value={stats.invited} label="Invitados registrados" accent />
      </div>

      <div className="flex justify-center">
        <Link to="/sponsor/ver-empresas" className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 text-uppercase-wide">
          <Search className="h-4 w-4" /> Explorar empresas
        </Link>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold text-uppercase-wide mb-3">📅 Agenda del evento</h2>
        <AgendaTable items={agenda} />
      </div>
    </div>
  );
}
