import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/dashboard/StatCard";
import { AgendaTable } from "@/components/dashboard/AgendaTable";
import { Bookmark, Heart, Calendar, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/empresa/dashboard")({
  component: EmpresaDashboard,
});

function EmpresaDashboard() {
  const [companyName, setCompanyName] = useState("");
  const [stats, setStats] = useState({ likes: 0, matches: 0, meetings: 0 });
  const [eventTitle, setEventTitle] = useState<string>("");
  const [agenda, setAgenda] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: ep } = await supabase.from("empresa_profiles").select("company_name").eq("user_id", user.id).maybeSingle();
      setCompanyName(ep?.company_name ?? "");

      const { data: ev } = await supabase.from("events").select("id, title").in("status", ["published","ongoing"]).order("event_date", { ascending: true }).limit(1).maybeSingle();
      if (ev) {
        setEventTitle(ev.title);
        const { data: ag } = await supabase.from("event_agenda").select("*").eq("event_id", ev.id).order("order_index");
        setAgenda(ag ?? []);
      }

      const { count: likes } = await supabase.from("likes").select("*", { count: "exact", head: true }).eq("from_user_id", user.id);
      const { count: matches } = await supabase.from("matches").select("*", { count: "exact", head: true }).eq("empresa_user_id", user.id).eq("status","mutual");
      const { count: meetings } = await supabase.from("meetings_1to1").select("*", { count: "exact", head: true }).eq("empresa_user_id", user.id);
      setStats({ likes: likes ?? 0, matches: matches ?? 0, meetings: meetings ?? 0 });
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-uppercase-wide">Bienvenido, {companyName}</h1>
        {eventTitle && <p className="mt-1 text-xs text-uppercase-wide text-muted-foreground">Evento actual: {eventTitle}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Bookmark} value={`${stats.likes} / 12 mín.`} label="Soluciones seleccionadas" hint={stats.likes >= 12 ? "✓ Mínimo alcanzado" : `Te faltan ${12 - stats.likes} para llegar al mínimo`} accent to="/empresa/ver-sponsors" />
        <StatCard icon={Heart} value={stats.matches} label="Matches mutuos" accent to="/empresa/mis-matches" />
        <StatCard icon={Calendar} value={stats.meetings} label="1to1 agendadas" accent to="/empresa/reuniones-1to1" />
      </div>

      <div className="flex justify-center">
        <Link to="/empresa/ver-sponsors" className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 text-uppercase-wide">
          <Search className="h-4 w-4" /> Explorar soluciones
        </Link>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold text-uppercase-wide mb-3">📅 Agenda del evento</h2>
        <AgendaTable items={agenda} />
      </div>
    </div>
  );
}
