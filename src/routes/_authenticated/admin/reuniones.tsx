import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { ClipboardList, Wand2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listEvents } from "@/lib/admin-events.functions";
import { listMeetings, autoAssignSlots, updateMeeting, deleteMeeting } from "@/lib/admin-meetings.functions";

export const Route = createFileRoute("/_authenticated/admin/reuniones")({
  component: AdminReuniones,
});

function AdminReuniones() {
  const listEv = useServerFn(listEvents);
  const list = useServerFn(listMeetings);
  const autoAssign = useServerFn(autoAssignSlots);
  const upd = useServerFn(updateMeeting);
  const del = useServerFn(deleteMeeting);
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await listEv({ data: undefined as any });
        setEvents(r.events);
        if (r.events[0]) setEventId(r.events[0].id);
      } catch (e: any) { toast.error(e?.message ?? "Error"); }
    })();
  }, []);

  async function load() {
    if (!eventId) { setRows([]); return; }
    try { const r = await list({ data: { event_id: eventId } }); setRows(r.meetings); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  useEffect(() => { load(); }, [eventId]);

  async function runAuto() {
    if (!eventId) return;
    setBusy(true);
    try {
      const r = await autoAssign({ data: { event_id: eventId } });
      toast.success(`Asignadas ${r.assigned} · Sin slot ${r.skipped}`);
      load();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reuniones 1to1" subtitle="Asignación automática y manual de speed-meetings" right={
        <button onClick={runAuto} disabled={busy || !eventId} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
          <Wand2 className="h-4 w-4" /> {busy ? "Asignando…" : "Auto-asignar slots"}
        </button>
      } />

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-uppercase-wide text-muted-foreground">Evento</label>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-xs">
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      {rows.length === 0 ? <EmptyState icon={ClipboardList} title="Sin reuniones" hint="Aparecerán cuando empresas y sponsors hagan match" /> : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] text-uppercase-wide text-muted-foreground"><tr>
              <th className="px-4 py-3 text-left">Empresa</th><th className="px-4 py-3 text-left">Sponsor</th><th className="px-4 py-3 text-left">Hora</th><th className="px-4 py-3 text-left">Sala</th><th className="px-4 py-3 text-left">Estado</th><th />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-xs">{r.empresa_name}</td>
                  <td className="px-4 py-3 font-medium text-xs">{r.sponsor_name}</td>
                  <td className="px-4 py-3">
                    <input type="datetime-local" defaultValue={r.scheduled_time ? new Date(r.scheduled_time).toISOString().slice(0, 16) : ""} onBlur={async (e) => {
                      const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                      if (v === r.scheduled_time) return;
                      try { await upd({ data: { id: r.id, patch: { scheduled_time: v } } }); toast.success("Hora actualizada"); load(); }
                      catch (err: any) { toast.error(err?.message ?? "Error"); }
                    }} className="rounded-md border border-border bg-input px-2 py-1 text-xs" />
                  </td>
                  <td className="px-4 py-3">
                    <input defaultValue={r.room ?? ""} onBlur={async (e) => {
                      if (e.target.value === (r.room ?? "")) return;
                      try { await upd({ data: { id: r.id, patch: { room: e.target.value || null } } }); toast.success("Sala actualizada"); load(); }
                      catch (err: any) { toast.error(err?.message ?? "Error"); }
                    }} className="w-24 rounded-md border border-border bg-input px-2 py-1 text-xs" />
                  </td>
                  <td className="px-4 py-3">
                    <select value={r.status} onChange={async (e) => {
                      try { await upd({ data: { id: r.id, patch: { status: e.target.value as any } } }); toast.success("Estado actualizado"); load(); }
                      catch (err: any) { toast.error(err?.message ?? "Error"); }
                    }} className="rounded-md border border-border bg-input px-2 py-1 text-xs">
                      {["pending", "confirmed", "completed", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={async () => {
                      if (!window.confirm("¿Eliminar reunión?")) return;
                      try { await del({ data: { id: r.id } }); toast.success("Eliminada"); load(); }
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
