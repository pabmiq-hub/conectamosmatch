import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyEventScope } from "@/hooks/use-my-event";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Range = { from: string; to: string };
type DayState = { attends: boolean; blocked: Range[]; max: string; notes: string };

const hhmm = (t?: string | null) => (t ?? "").slice(0, 5);
const fmtDay = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

/** Lets the signed-in attendee mark, per event day, whether they attend and which 1to1 blocks they can't make. */
export function AvailabilityEditor({ eventId, targetUserId, onSaved }: { eventId?: string; targetUserId?: string; onSaved?: () => void } = {}) {
  const adminMode = !!(eventId && targetUserId);
  const [event, setEvent] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Record<string, Range[]>>({});
  const [days, setDays] = useState<Record<string, DayState>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editorId, setEditorId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user: me } } = await supabase.auth.getUser();
      const ev = adminMode
        ? (await supabase.from("events").select("*").eq("id", eventId!).maybeSingle()).data
        : (await fetchMyEventScope()).event;
      const uid = adminMode ? targetUserId! : me?.id;
      setLoaded(true);
      if (!me || !uid || !ev) return;
      setUserId(uid); setEditorId(me.id); setEvent(ev);
      const { data: ag } = await supabase.from("event_agenda").select("event_date, time_start, time_end, agenda_type").eq("event_id", ev.id).order("time_start");
      const b: Record<string, Range[]> = {};
      for (const a of ag ?? []) {
        if (!a.event_date) continue;
        b[a.event_date] ??= [];
        if (a.agenda_type === "reuniones_1to1" && a.time_start && a.time_end)
          b[a.event_date].push({ from: hhmm(a.time_start), to: hhmm(a.time_end) });
      }
      if (!Object.keys(b).length && ev.event_date) b[ev.event_date.slice(0, 10)] = [];
      setBlocks(b);
      const { data: av } = await supabase.from("attendee_availability").select("*").eq("event_id", ev.id).eq("user_id", uid);
      const d: Record<string, DayState> = {};
      for (const k of Object.keys(b)) {
        const r: any = (av ?? []).find((x: any) => x.event_date === k);
        d[k] = { attends: r?.attends ?? true, blocked: (r?.blocked_ranges as Range[]) ?? [], max: r?.max_meetings?.toString() ?? "", notes: r?.notes ?? "" };
      }
      setDays(d);
    })();
  }, [eventId, targetUserId]);

  const upd = (k: string, p: Partial<DayState>) => setDays((s) => ({ ...s, [k]: { ...s[k], ...p } }));
  const isBlocked = (k: string, r: Range) => days[k]?.blocked.some((x) => x.from === r.from && x.to === r.to);
  const toggle = (k: string, r: Range, available: boolean) =>
    upd(k, { blocked: available ? days[k].blocked.filter((x) => !(x.from === r.from && x.to === r.to)) : [...days[k].blocked, r] });

  const save = async () => {
    if (!userId || !event) return;
    setSaving(true);
    const rows = Object.entries(days).map(([k, s]) => ({
      event_id: event.id, user_id: userId, event_date: k, attends: s.attends,
      blocked_ranges: s.attends ? s.blocked : [], max_meetings: s.max ? Math.max(0, parseInt(s.max, 10)) : null,
      notes: s.notes.trim() || null, updated_by: editorId ?? userId,
    }));
    const { error } = await supabase.from("attendee_availability").upsert(rows as any, { onConflict: "event_id,user_id,event_date" });
    setSaving(false);
    error ? toast.error("No se pudo guardar: " + error.message) : (toast.success("Disponibilidad guardada"), onSaved?.());
  };

  const readOnly = !adminMode && event && !event.allow_participant_availability;
  if (loaded && !event) return <p className="text-sm text-muted-foreground">{adminMode ? "No se encontró el evento." : "No hay ningún evento publicado ahora mismo."}</p>;

  return (
    <div className="space-y-4">
      {readOnly && <p className="rounded-lg border bg-muted/40 p-3 text-sm">La organización gestiona la disponibilidad de este evento. Si necesitas cambiar algo, contacta con ella.</p>}
      <fieldset disabled={!!readOnly} className="space-y-4 disabled:opacity-70">
      {event && <p className="text-sm text-muted-foreground">{event.title} · {adminMode ? "Restricciones que se respetarán al proponer sus reuniones 1to1." : "La organización usará esto para proponer tus reuniones 1to1."}</p>}
      {Object.keys(days).sort().map((k) => {
        const s = days[k];
        return (
          <div key={k} className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold capitalize">{fmtDay(k)}</h3>
              <label className="flex items-center gap-2 text-sm">Asisto <Switch checked={s.attends} onCheckedChange={(v) => upd(k, { attends: v })} /></label>
            </div>
            {s.attends && (
              <>
                {blocks[k]?.length ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Franjas de reuniones en las que puedo:</p>
                    {blocks[k].map((r) => (
                      <label key={r.from} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={!isBlocked(k, r)} onCheckedChange={(v) => toggle(k, r, !!v)} />
                        {r.from} – {r.to}
                      </label>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">La agenda de este día aún no tiene franjas de reuniones.</p>}
                <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                  <label className="text-sm space-y-1"><span>Máx. reuniones este día</span>
                    <Input type="number" min={0} placeholder="Sin límite" value={s.max} onChange={(e) => upd(k, { max: e.target.value })} /></label>
                  <label className="text-sm space-y-1"><span>Notas para la organización</span>
                    <Input placeholder="Ej.: llego a las 18:00" value={s.notes} onChange={(e) => upd(k, { notes: e.target.value })} /></label>
                </div>
              </>
            )}
          </div>
        );
      })}
      </fieldset>
      {event && !readOnly && <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar disponibilidad"}</Button>}
    </div>
  );
}
