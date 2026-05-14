import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { ListChecks, Plus, Edit3, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { listAgenda, deleteAgendaItem } from "@/lib/admin-agenda.functions";
import { AgendaItemModal } from "@/components/admin/AgendaItemModal";

export const Route = createFileRoute("/_authenticated/admin/eventos/$id/agenda")({
  component: AdminAgenda,
});

function AdminAgenda() {
  const { id } = Route.useParams();
  const list = useServerFn(listAgenda);
  const del = useServerFn(deleteAgendaItem);
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [show, setShow] = useState(false);

  async function load() {
    try { const r = await list({ data: { event_id: id } }); setItems(r.items); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  useEffect(() => { load(); }, [id]);

  return (
    <div className="space-y-6">
      <Link to="/admin/eventos" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Volver a eventos</Link>
      <PageHeader title="Agenda del evento" subtitle="Ponencias, mesas redondas, descansos y networking" right={
        <button onClick={() => { setEditing(null); setShow(true); }} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide">
          <Plus className="h-4 w-4" /> Nuevo item
        </button>
      } />
      {show && <AgendaItemModal eventId={id} item={editing} onClose={() => setShow(false)} onSaved={load} />}
      {items.length === 0 ? <EmptyState icon={ListChecks} title="Sin agenda" hint="Añade el primer item" /> : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] text-uppercase-wide text-muted-foreground"><tr>
              <th className="px-4 py-3 text-left">Orden</th><th className="px-4 py-3 text-left">Título</th><th className="px-4 py-3 text-left">Tipo</th><th className="px-4 py-3 text-left">Hora</th><th className="px-4 py-3 text-left">Sala</th><th className="px-4 py-3 text-left">Ponente</th><th />
            </tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-border">
                  <td className="px-4 py-3 text-xs">{it.order_index}</td>
                  <td className="px-4 py-3 font-medium text-xs">{it.title}</td>
                  <td className="px-4 py-3 text-xs"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{it.agenda_type ?? "—"}</span></td>
                  <td className="px-4 py-3 font-mono text-[11px]">{it.time_start ?? "—"}{it.time_end ? `–${it.time_end}` : ""}</td>
                  <td className="px-4 py-3 text-xs">{it.room ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{it.speaker_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditing(it); setShow(true); }} className="p-1.5 text-muted-foreground hover:text-foreground"><Edit3 className="h-4 w-4" /></button>
                    <button onClick={async () => {
                      if (!window.confirm("¿Eliminar este item?")) return;
                      try { await del({ data: { id: it.id } }); toast.success("Eliminado"); load(); }
                      catch (e: any) { toast.error(e?.message ?? "Error"); }
                    }} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
