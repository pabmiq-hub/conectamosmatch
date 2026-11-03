import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { ICEBREAKER_COUNT, RETO_DEFAULT_ICEBREAKERS, mergeIcebreakers, retoDb, type IcebreakerRow } from "@/lib/reto";
import { MessageCircleQuestion, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reto-comodines")({
  head: () => ({
    meta: [
      { title: "Comodines Rompe el hielo · Admin · Conectamos" },
      { name: "description", content: "Edita las 27 preguntas del comodín «Rompe el hielo» del Reto 2.700." },
      { property: "og:title", content: "Comodines Rompe el hielo · Admin" },
      { property: "og:description", content: "Edita las 27 preguntas del comodín «Rompe el hielo» del Reto 2.700." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminRetoComodines,
});

type Ev = { event_id: string; title: string };

function AdminRetoComodines() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [missingTable, setMissingTable] = useState(false);

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
    const { data, error } = await retoDb.from("reto_icebreakers").select("position, question").eq("event_id", ev).order("position");
    setMissingTable(!!error);
    const qs = mergeIcebreakers((data ?? []) as IcebreakerRow[]);
    setSaved(qs);
    setDraft(qs);
  }, []);

  useEffect(() => { if (eventId) load(eventId); }, [eventId, load]);

  const changed = draft.reduce((n, q, i) => n + (q.trim() !== (saved[i] ?? "").trim() ? 1 : 0), 0);
  const invalid = draft.findIndex((q) => q.trim().length < 3 || q.trim().length > 200);

  const save = async () => {
    if (!eventId) return;
    if (invalid >= 0) { toast.error(`La pregunta ${invalid + 1} debe tener entre 3 y 200 caracteres.`); return; }
    setBusy(true);
    const rows = draft.map((q, i) => ({ event_id: eventId, position: i + 1, question: q.trim() }));
    const { error } = await retoDb.from("reto_icebreakers").upsert(rows, { onConflict: "event_id,position" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Comodines guardados");
    await load(eventId);
  };

  if (loading) return <div className="text-xs text-muted-foreground text-uppercase-wide">Cargando…</div>;
  if (!events.length) return <EmptyState icon={MessageCircleQuestion} title="No hay ningún evento con Reto 2.700" hint="Configura primero un evento con el Reto." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Comodines Rompe el hielo"
        subtitle={`Las ${ICEBREAKER_COUNT} preguntas que salen al azar en «Dame un comodín». No suman puntos.`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            {events.length > 1 && (
              <select value={eventId ?? ""} onChange={(e) => setEventId(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-xs">
                {events.map((e) => <option key={e.event_id} value={e.event_id}>{e.title}</option>)}
              </select>
            )}
            <button onClick={() => setDraft(saved)} disabled={!changed || busy}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium disabled:opacity-40">
              <RotateCcw className="h-3.5 w-3.5" /> Descartar
            </button>
            <button onClick={save} disabled={busy || missingTable}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40">
              <Save className="h-3.5 w-3.5" /> {busy ? "Guardando…" : changed ? `Guardar (${changed})` : "Guardar"}
            </button>
          </div>
        }
      />

      {missingTable && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          Falta ejecutar el archivo de la fase 7 en la base de datos. Mientras tanto se muestran las preguntas por defecto.
        </div>
      )}

      <ol className="space-y-2">
        {draft.map((q, i) => {
          const isDirty = q.trim() !== (saved[i] ?? "").trim();
          return (
            <li key={i} className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
              <span className="mt-2 w-7 shrink-0 text-right font-display text-sm font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex-1">
                <input
                  value={q}
                  maxLength={200}
                  onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? e.target.value : x)))}
                  className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${isDirty ? "border-primary" : "border-input"}`}
                />
                {q.trim() !== RETO_DEFAULT_ICEBREAKERS[i] && (
                  <button onClick={() => setDraft((d) => d.map((x, j) => (j === i ? RETO_DEFAULT_ICEBREAKERS[i] : x)))}
                    className="mt-1 text-[11px] text-muted-foreground underline hover:text-foreground">
                    Volver a la pregunta original
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
