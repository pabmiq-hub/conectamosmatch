import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAccountDashboard } from "@/lib/account-dashboard.functions";
import { toast } from "sonner";
import { fetchMyEventScope } from "@/hooks/use-my-event";
import { StatCard } from "@/components/dashboard/StatCard";
import { AgendaTable } from "@/components/dashboard/AgendaTable";
import { Bookmark, Heart, Calendar, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { listMyLikedAccountIds } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/empresa/dashboard")({
  head: () => ({ meta: [{ title: "Mi panel de empresa | Conectamos Match" }, { name: "description", content: "Selecciones, matches y reuniones de tu cuenta en Conectamos Match." }, { property: "og:title", content: "Mi panel de empresa | Conectamos Match" }, { property: "og:description", content: "Actividad de tu cuenta y agenda del evento." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: EmpresaDashboard,
});

function EmpresaDashboard() {
  const [companyName, setCompanyName] = useState("");
  const [stats, setStats] = useState({ likes: 0, matches: 0, meetings: 0 });
  const [eventTitle, setEventTitle] = useState<string>("");
  const [minLikes, setMinLikes] = useState(12);
  const [agenda, setAgenda] = useState<any[]>([]);
  const getLikedAccounts = useServerFn(listMyLikedAccountIds);

  const getDashboard = useServerFn(getAccountDashboard);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const scope = await fetchMyEventScope();
      const ev = scope.event;
      const activity = await getDashboard({ data: { eventId: ev?.id ?? null } });
      setCompanyName(activity.name);
      if (ev) {
        setEventTitle(ev.title); setMinLikes((ev as any).empresa_min_likes ?? 12);
        const { data: ag } = await supabase.from("event_agenda").select("*").eq("event_id", ev.id).order("order_index");
        setAgenda(ag ?? []);
      }

      const liked = await getLikedAccounts({ data: { eventId: ev?.id ?? null } });
      const likes = liked.accountIds.length;
      if (!ev) { setStats({ likes: 0, matches: 0, meetings: 0 }); return; }
      setStats({ likes, matches: activity.matches, meetings: activity.meetings });
    })().catch((e) => toast.error(e?.message ?? "No se pudo cargar la actividad"));
  }, []);


  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-uppercase-wide">Bienvenido, {companyName}</h1>
        <p className="mt-1 text-xs text-uppercase-wide text-muted-foreground">{eventTitle ? `Evento actual: ${eventTitle}` : "Todavía no estás inscrito en ningún evento activo"}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Bookmark} value={`${stats.likes} / ${minLikes} mín.`} label="Soluciones seleccionadas" hint={stats.likes >= minLikes ? "✓ Mínimo alcanzado" : `Te faltan ${minLikes - stats.likes} para llegar al mínimo`} accent to="/empresa/ver-sponsors" />
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
