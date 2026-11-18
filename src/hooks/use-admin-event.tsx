import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listEvents } from "@/lib/admin-events.functions";

const KEY = "admin-active-event";
const EVT = "admin-active-event-change";

/** Shared active event for the superadmin panel ("" = todos los eventos). */
export function useAdminEvent() {
  const [eventId, setLocal] = useState<string>("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setLocal(localStorage.getItem(KEY) ?? "");
    setReady(true);
    const h = () => setLocal(localStorage.getItem(KEY) ?? "");
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  const setEventId = (id: string) => {
    localStorage.setItem(KEY, id);
    window.dispatchEvent(new Event(EVT));
  };
  return { eventId, setEventId, ready };
}

export function AdminEventSelector({ allowAll = true }: { allowAll?: boolean }) {
  const listEv = useServerFn(listEvents);
  const { eventId, setEventId, ready } = useAdminEvent();
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await listEv({ data: undefined as any });
        setEvents(r.events);
        const stored = localStorage.getItem(KEY) ?? "";
        const valid = r.events.some((e: any) => e.id === stored);
        if ((!allowAll && !valid) || (stored && !valid)) {
          const first = r.events.find((e: any) => ["ongoing", "published"].includes(e.status)) ?? r.events[0];
          setEventId(first?.id ?? "");
        }
      } catch {}
    })();
  }, [allowAll]);
  if (!ready) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
      <label className="text-xs font-bold text-uppercase-wide text-primary">Evento activo</label>
      <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs min-w-[220px]">
        {allowAll && <option value="">Todos los eventos</option>}
        {events.map((e) => <option key={e.id} value={e.id}>{e.title}{e.status === "finished" ? " (finalizado)" : ""}</option>)}
      </select>
    </div>
  );
}
