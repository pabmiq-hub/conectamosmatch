import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Calendar, MapPin, Users, Plus, Edit3 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/eventos")({
  component: AdminEventos,
});

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-primary/15 text-primary",
  ongoing: "bg-success/15 text-success",
  finished: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/15 text-destructive",
};

function AdminEventos() {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("events").select("*").order("event_date", { ascending: false });
      setEvents(data ?? []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Eventos" subtitle="Gestión de eventos, agendas y participantes" right={
        <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide" onClick={() => toast.info("Crear evento: próximamente con wizard de agenda")}>
          <Plus className="h-4 w-4" /> Crear evento
        </button>
      } />

      {events.length === 0 ? <EmptyState icon={Calendar} title="Sin eventos" hint="Crea el primero" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((e) => (
            <div key={e.id} className="rounded-xl border border-border bg-card overflow-hidden card-hover">
              {e.cover_image_url && <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${e.cover_image_url})` }} />}
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-uppercase-wide">{e.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide ${statusColors[e.status] ?? "bg-muted"}`}>{e.status}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{e.description}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{e.event_date && new Date(e.event_date).toLocaleDateString("es-ES")}</div>
                  <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{e.location_city ?? "Online"}</div>
                  <div className="flex items-center gap-1.5"><Users className="h-3 w-3" />{e.max_empresas ?? 0} empresas</div>
                  <div className="flex items-center gap-1.5"><Users className="h-3 w-3" />{e.max_sponsors ?? 0} sponsors</div>
                </div>
                <button className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-[11px] font-bold text-uppercase-wide hover:bg-muted">
                  <Edit3 className="h-3 w-3" /> Editar agenda
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
