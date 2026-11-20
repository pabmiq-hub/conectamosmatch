import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAccountDashboard } from "@/lib/account-dashboard.functions";
import { toast } from "sonner";
import { fetchMyEventScope } from "@/hooks/use-my-event";
import { StatCard } from "@/components/dashboard/StatCard";
import { AgendaTable } from "@/components/dashboard/AgendaTable";
import { LevelBadge } from "@/components/brand/LevelBadge";
import { Heart, Calendar, Search, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sponsor/dashboard")({
  head: () => ({ meta: [{ title: "Mi panel de solución | Conectamos Match" }, { name: "description", content: "Selecciones, matches y reuniones de tu cuenta en Conectamos Match." }, { property: "og:title", content: "Mi panel de solución | Conectamos Match" }, { property: "og:description", content: "Actividad de tu cuenta y agenda del evento." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SponsorDashboard,
});

function SponsorDashboard() {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<string>("BASIC");
  const [agenda, setAgenda] = useState<any[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [stats, setStats] = useState({ matches: 0, meetings: 0 });

  const getDashboard = useServerFn(getAccountDashboard);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const scope = await fetchMyEventScope();
      const ev = scope.event;
      const activity = await getDashboard({ data: { eventId: ev?.id ?? null } });
      setName(activity.name); setLevel(activity.level);
      if (ev) {
        setEventTitle(ev.title);
        const { data: ag } = await supabase.from("event_agenda").select("*").eq("event_id", ev.id).order("order_index");
        setAgenda(ag ?? []);
      }
      if (!ev) { setStats({ matches: 0, meetings: 0 }); return; }
      setStats({ matches: activity.matches, meetings: activity.meetings });
    })().catch((e) => toast.error(e?.message ?? "No se pudo cargar la actividad"));
  }, []);

  const isStartup = level === "STARTUP";
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-uppercase-wide">Bienvenido, {name}</h1>
          <p className="mt-1 text-xs text-uppercase-wide text-muted-foreground">{eventTitle ? `Evento actual: ${eventTitle}` : "Todavía no estás inscrito en ningún evento activo"}</p>
        </div>
        <LevelBadge level={level} />
      </div>

      {isStartup && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-foreground shrink-0" />
          <div className="text-xs">
            <div className="font-bold text-uppercase-wide">Nivel STARTUP</div>
            <div className="mt-1 text-muted-foreground">Algunas funciones premium (charla magistral, stand premium, mesas redondas) están reservadas para niveles superiores. Contacta con el organizador para subir de nivel.</div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard icon={Heart} value={stats.matches} label="Matches mutuos" accent to="/sponsor/mis-matches" />
        <StatCard icon={Calendar} value={stats.meetings} label="1to1 agendadas" accent to="/sponsor/reuniones-1to1" />
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
