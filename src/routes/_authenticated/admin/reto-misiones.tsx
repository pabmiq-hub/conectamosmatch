import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { retoDb } from "@/lib/reto";
import { RefreshCw, Target } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reto-misiones")({
  head: () => ({
    meta: [
      { title: "Misiones del Reto 2.700 · Admin · Conectamos" },
      { name: "description", content: "Activa o desactiva las misiones del Reto 2.700 y recalcula los bonus." },
      { property: "og:title", content: "Misiones del Reto 2.700 · Admin" },
      { property: "og:description", content: "Activa o desactiva las misiones del Reto 2.700 y recalcula los bonus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminRetoMisiones,
});

type Ev = { event_id: string; title: string };
type Mission = {
  id: string; code: string; title: string; description: string | null; type: string;
  threshold: number; bonus_points: number; max_awards: number; starts_at: string | null;
  enabled: boolean; status: string; order_index: number;
};

function toMadridLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function fromMadridLocal(v: string): string | null {
  if (!v) return null;
  const guess = new Date(`${v}:00Z`);
  const local = toMadridLocal(guess.toISOString());
  const diff = new Date(`${local}:00Z`).getTime() - guess.getTime();
  return new Date(guess.getTime() - diff).toISOString();
}

function AdminRetoMisiones() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [awards, setAwards] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: cfg } = await retoDb.from("reto_config").select("event_id");
      const ids = (cfg ?? []).map((c: any) => c.event_id);
      if (ids.length) {
        const { data: evs } = await retoDb.from("events").select("id, title").in("id", ids);
        const list = (evs ?? []).map((e: any) => ({ event_id: e.id, title: e.title }));
        setEvents(list);
        setEventId(list[0]?.event_id ?? null);
      }
      setLoading(false);
    })();
  }, []);

  const load = useCallback(async (ev: string) => {
    const [{ data: ms, error }, { data: aw }] = await Promise.all([
      retoDb.from("reto_missions").select("*").eq("event_id", ev).order("order_index"),
      retoDb.from("reto_mission_awards").select("mission_id").eq("event_id", ev),
    ]);
    if (error) { toast.error("Las misiones aún no están preparadas en la base de datos."); return; }
    setMissions(ms ?? []);
    const count: Record<string, number> = {};
    (aw ?? []).forEach((a: any) => { count[a.mission_id] = (count[a.mission_id] ?? 0) + 1; });
    setAwards(count);
  }, []);

  useEffect(() => { if (eventId) load(eventId); }, [eventId, load]);

  const update = async (m: Mission, patch: Partial<Mission>) => {
    setBusy(true);
    const { error } = await retoDb.from("reto_missions").update(patch).eq("id", m.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Misión actualizada y bonus recalculados");
    if (eventId) load(eventId);
  };

  const recalc = async () => {
    if (!eventId) return;
    setBusy(true);
    const { error } = await retoDb.rpc("reto_recalc_event", { _event: eventId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bonus recalculados");
    load(eventId);
  };

  if (loading) return <div className="text-xs text-muted-foreground text-uppercase-wide">Cargando…</div>;
  if (!eventId) return <EmptyState icon={Target} title="Ningún evento tiene el Reto 2.700" hint="Se configurará en la fase de administración." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Misiones del Reto 2.700"
        subtitle="Desactivar una misión retira sus bonus al instante. Los puntos solo los calcula el sistema."
        right={
          <button onClick={recalc} disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-accent disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Recalcular
          </button>
        }
      />
      {events.length > 1 && (
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
          {events.map((e) => <option key={e.event_id} value={e.event_id}>{e.title}</option>)}
        </select>
      )}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-[10px] text-uppercase-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Misión</th>
              <th className="px-3 py-2 text-right">Umbral</th>
              <th className="px-3 py-2 text-right">Bonus</th>
              <th className="px-3 py-2 text-left">Se activa (Madrid)</th>
              <th className="px-3 py-2 text-right">Conseguida por</th>
              <th className="px-3 py-2 text-center">Activa</th>
            </tr>
          </thead>
          <tbody>
            {missions.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <div className="font-bold">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.description}</div>
                </td>
                <td className="px-3 py-2 text-right">{m.threshold}</td>
                <td className="px-3 py-2 text-right">+{m.bonus_points}{m.max_awards > 1 ? ` ×${m.max_awards}` : ""}</td>
                <td className="px-3 py-2">
                  <input type="datetime-local" disabled={busy} defaultValue={toMadridLocal(m.starts_at)}
                    onBlur={(e) => {
                      const v = fromMadridLocal(e.target.value);
                      if (v !== m.starts_at) update(m, { starts_at: v });
                    }}
                    className="rounded border border-border bg-background px-2 py-1 text-xs" />
                </td>
                <td className="px-3 py-2 text-right">{awards[m.id] ?? 0}</td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" aria-label={`Activar ${m.title}`} checked={m.enabled} disabled={busy}
                    onChange={(e) => update(m, { enabled: e.target.checked })} className="h-4 w-4 accent-primary" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
