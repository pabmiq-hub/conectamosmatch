import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { importAgenda } from "@/lib/admin-agenda.functions";
import { parseAgendaText } from "@/lib/agenda-import";

const EXAMPLE = `DÍA 01 – 26 DE NOVIEMBRE

15:00 A 15:15 | APERTURA Lugar: Auditorio.

16:00 A 16:30 | TÍTULO DE LA CHARLA Caso de éxito de: Empresa. Lugar: Sala.`;

export function ImportAgendaModal({ eventId, hasItems, onClose, onSaved }: { eventId: string; hasItems: boolean; onClose: () => void; onSaved: () => void }) {
  const run = useServerFn(importAgenda);
  const [text, setText] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("events").select("event_date").eq("id", eventId).maybeSingle().then(({ data }) => {
      if (data?.event_date) setStartDate(new Date(data.event_date).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }));
    });
  }, [eventId]);

  const items = useMemo(() => (text.trim() ? parseAgendaText(text, startDate) : []), [text, startDate]);
  const days = useMemo(() => {
    const m = new Map<string, typeof items>();
    for (const it of items) { const k = it.event_date ?? `Día ${it.day_index}`; m.set(k, [...(m.get(k) ?? []), it]); }
    return [...m.entries()];
  }, [items]);

  async function save() {
    if (!items.length) return toast.error("No se ha detectado ningún bloque");
    if (replace && hasItems && !window.confirm("Se borrará la agenda actual y se sustituirá por la importada. ¿Continuar?")) return;
    setBusy(true);
    try {
      const r = await run({ data: { event_id: eventId, replace, items: items.map(({ day_index, ...it }) => ({ ...it, speaker_name: "", speaker_role: "" })) } });
      toast.success(`${r.inserted} bloques importados`);
      onSaved(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Error"); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Importar agenda</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">Sube un archivo .txt o pega el texto. Cada día empieza con «DÍA 01 – 26 DE NOVIEMBRE» y cada bloque con «HH:MM A HH:MM | TÍTULO … Lugar: sala.». Después podrás editar cada bloque.</p>
        <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold">
          <Upload className="h-4 w-4" /> Subir archivo .txt
          <input type="file" accept=".txt,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
        </label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} rows={8} className="w-full rounded-md border border-border bg-background p-3 font-mono text-xs" />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Sustituir la agenda actual del evento
        </label>
        {days.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="text-xs font-bold text-uppercase-wide text-muted-foreground">Vista previa · {items.length} bloques en {days.length} días</div>
            {days.map(([d, list]) => (
              <div key={d} className="rounded-lg border border-border">
                <div className="bg-primary/10 px-3 py-2 text-xs font-bold text-primary">{d}</div>
                {list.map((it, i) => (
                  <div key={i} className="grid grid-cols-[90px_1fr] gap-2 border-t border-border px-3 py-2 text-xs">
                    <span className="font-mono">{it.time_start}–{it.time_end}</span>
                    <div><div className="font-semibold">{it.title} <span className="ml-1 rounded-full bg-muted px-2 text-[10px]">{it.agenda_type}</span></div>
                      {it.description && <div className="text-muted-foreground">{it.description}</div>}
                      {it.room && <div className="text-muted-foreground">📍 {it.room}</div>}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-xs font-bold">Cancelar</button>
          <button disabled={busy || !items.length} onClick={save} className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">{busy ? "Importando…" : "Importar"}</button>
        </div>
      </div>
    </div>
  );
}
