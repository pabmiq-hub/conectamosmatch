import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Calendar, MapPin, Users, Plus, Edit3, Trash2, ClipboardList, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { listEvents, deleteEvent } from "@/lib/admin-events.functions";
import { EventModal } from "@/components/admin/EventModal";

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
  const list = useServerFn(listEvents);
  const del = useServerFn(deleteEvent);
  const [events, setEvents] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    try { const r = await list({ data: undefined as any }); setEvents(r.events); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Eventos" subtitle="Gestión de eventos, agendas y participantes" right={
        <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide" onClick={() => { setEditing(null); setShowModal(true); }}>
          <Plus className="h-4 w-4" /> Crear evento
        </button>
      } />

      {showModal && <EventModal event={editing} onClose={() => setShowModal(false)} onSaved={load} />}

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
                {e.description && <p className="text-xs text-muted-foreground line-clamp-2">{e.description}</p>}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{e.event_date && new Date(e.event_date).toLocaleDateString("es-ES")}</div>
                  <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{e.location_city || (e.is_virtual ? "Online" : "—")}</div>
                  <div className="flex items-center gap-1.5"><Users className="h-3 w-3" />{e.max_empresas ?? "∞"} emp · {e.max_sponsors ?? "∞"} spo</div>
                  <div className="flex items-center gap-1.5"><ClipboardList className="h-3 w-3" />{e.meetings_per_user ?? 8} reuniones</div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button onClick={() => { setEditing(e); setShowModal(true); }} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-[11px] font-bold text-uppercase-wide hover:bg-muted">
                    <Edit3 className="h-3 w-3" /> Editar
                  </button>
                  <Link to="/admin/eventos/$id/agenda" params={{ id: e.id }} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-[11px] font-bold text-uppercase-wide hover:bg-muted">
                    <ListChecks className="h-3 w-3" /> Agenda
                  </Link>
                  <Link to="/admin/eventos/$id/registros" params={{ id: e.id }} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-[11px] font-bold text-uppercase-wide hover:bg-muted">
                    <Users className="h-3 w-3" /> Registros
                  </Link>
                  <button onClick={async () => {
                    if (!window.confirm(`¿Eliminar "${e.title}"? Se borrarán reuniones, matches y registros del evento.`)) return;
                    try { await del({ data: { id: e.id } }); toast.success("Eliminado"); load(); }
                    catch (err: any) { toast.error(err?.message ?? "Error"); }
                  }} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/40 text-destructive px-3 py-2 text-[11px] font-bold text-uppercase-wide hover:bg-destructive/10">
                    <Trash2 className="h-3 w-3" /> Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
