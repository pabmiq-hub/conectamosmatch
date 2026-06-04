import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Calendar, MapPin, Users, Plus, Edit3, Trash2, ClipboardList, ListChecks, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { listEvents, deleteEvent } from "@/lib/admin-events.functions";
import { listAgenda, deleteAgendaItem } from "@/lib/admin-agenda.functions";
import { EventModal } from "@/components/admin/EventModal";
import { AgendaItemModal } from "@/components/admin/AgendaItemModal";

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
  const [openAgendaId, setOpenAgendaId] = useState<string | null>(null);

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
                  <button
                    type="button"
                    onClick={() => setOpenAgendaId((cur) => (cur === e.id ? null : e.id))}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-[11px] font-bold text-uppercase-wide hover:bg-muted"
                  >
                    <ListChecks className="h-3 w-3" /> Agenda
                    {openAgendaId === e.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
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
              {openAgendaId === e.id && <AgendaInlinePanel eventId={e.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgendaInlinePanel({ eventId }: { eventId: string }) {
  const list = useServerFn(listAgenda);
  const del = useServerFn(deleteAgendaItem);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    try { const r = await list({ data: { event_id: eventId } }); setItems(r.items); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [eventId]);

  return (
    <div className="border-t border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold text-uppercase-wide text-muted-foreground">Agenda del evento</div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[10px] font-bold text-primary-foreground text-uppercase-wide"
        >
          <Plus className="h-3 w-3" /> Item
        </button>
      </div>

      {showModal && <AgendaItemModal eventId={eventId} item={editing} onClose={() => setShowModal(false)} onSaved={load} />}

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin items en la agenda. Añade el primero.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-start justify-between gap-2 rounded-md border border-border bg-card p-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {it.time_start ?? "—"}{it.time_end ? `–${it.time_end}` : ""}
                  </span>
                  {it.agenda_type && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-uppercase-wide">{it.agenda_type}</span>}
                </div>
                <div className="text-xs font-semibold truncate">{it.title}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {it.room ? `${it.room} · ` : ""}{it.speaker_name ?? ""}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => { setEditing(it); setShowModal(true); }} className="p-1.5 text-muted-foreground hover:text-foreground"><Edit3 className="h-3.5 w-3.5" /></button>
                <button onClick={async () => {
                  if (!window.confirm("¿Eliminar este item?")) return;
                  try { await del({ data: { id: it.id } }); toast.success("Eliminado"); load(); }
                  catch (e: any) { toast.error(e?.message ?? "Error"); }
                }} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
