import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createAgendaItem, updateAgendaItem } from "@/lib/admin-agenda.functions";

const AGENDA_TYPES = ["bienvenida", "charla", "panel", "coffee_break", "comida", "networking", "reuniones_1to1", "cierre"] as const;

export function AgendaItemModal({ eventId, item, onClose, onSaved }: { eventId: string; item: any | null; onClose: () => void; onSaved: () => void }) {
  const create = useServerFn(createAgendaItem);
  const update = useServerFn(updateAgendaItem);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: "",
    description: "",
    speaker_name: "",
    speaker_role: "",
    room: "",
    agenda_type: "charla" as (typeof AGENDA_TYPES)[number],
    event_date: "",
    time_start: "",
    time_end: "",
    order_index: 0,
  });

  useEffect(() => {
    if (item) {
      setF({
        title: item.title ?? "",
        description: item.description ?? "",
        speaker_name: item.speaker_name ?? "",
        speaker_role: item.speaker_role ?? "",
        room: item.room ?? "",
        agenda_type: item.agenda_type ?? "charla",
        event_date: item.event_date ?? "",
        time_start: item.time_start ?? "",
        time_end: item.time_end ?? "",
        order_index: item.order_index ?? 0,
      });
    }
  }, [item]);

  const set = (k: keyof typeof f, v: any) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!f.title.trim()) return toast.error("Título obligatorio");
    setBusy(true);
    try {
      const payload = {
        event_id: eventId,
        title: f.title,
        description: f.description,
        speaker_name: f.speaker_name,
        speaker_role: f.speaker_role,
        room: f.room,
        agenda_type: f.agenda_type,
        event_date: f.event_date || null,
        time_start: f.time_start || null,
        time_end: f.time_end || null,
        order_index: Number(f.order_index) || 0,
      };
      if (item?.id) {
        await update({ data: { id: item.id, patch: payload } });
        toast.success("Item actualizado");
      } else {
        await create({ data: payload });
        toast.success("Item creado");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-lg font-bold text-uppercase-wide">{item ? "Editar item" : "Nuevo item"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <L>Título *</L>
            <input value={f.title} onChange={(e) => set("title", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <L>Descripción</L>
            <textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div>
            <L>Tipo</L>
            <select value={f.agenda_type} onChange={(e) => set("agenda_type", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
              {AGENDA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <L>Sala</L>
            <input value={f.room} onChange={(e) => set("room", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div>
            <L>Ponente</L>
            <input value={f.speaker_name} onChange={(e) => set("speaker_name", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div>
            <L>Cargo del ponente</L>
            <input value={f.speaker_role} onChange={(e) => set("speaker_role", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div>
            <L>Fecha</L>
            <input type="date" value={f.event_date} onChange={(e) => set("event_date", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div>
            <L>Orden</L>
            <input type="number" value={f.order_index} onChange={(e) => set("order_index", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div>
            <L>Hora inicio</L>
            <input type="time" value={f.time_start} onChange={(e) => set("time_start", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div>
            <L>Hora fin</L>
            <input type="time" value={f.time_end} onChange={(e) => set("time_end", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-md border border-border py-2.5 text-sm font-bold text-uppercase-wide">Cancelar</button>
          <button onClick={submit} disabled={busy} className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function L({ children }: { children: React.ReactNode }) {
  return <label className="text-xs text-uppercase-wide text-muted-foreground">{children}</label>;
}
