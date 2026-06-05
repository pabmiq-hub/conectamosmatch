import type { Database } from "@/integrations/supabase/types";

type AgendaRow = Database["public"]["Tables"]["event_agenda"]["Row"];

const typeMeta: Record<string, { label: string; emoji: string; color: string }> = {
  bienvenida:    { label: "BIENVENIDA",    emoji: "👋", color: "bg-muted text-foreground" },
  charla:        { label: "CHARLA",        emoji: "🎤", color: "bg-primary/20 text-primary" },
  networking:    { label: "NETWORKING",    emoji: "🤝", color: "bg-success/20 text-success" },
  coffee_break:  { label: "COFFEE BREAK",  emoji: "☕", color: "bg-bronze/30 text-foreground" },
  comida:        { label: "COMIDA",        emoji: "🍽️", color: "bg-bronze/30 text-foreground" },
  reuniones_1to1:{ label: "REUNIONES 1TO1",emoji: "📅", color: "bg-primary text-primary-foreground" },
  cierre:        { label: "CIERRE",        emoji: "🏆", color: "bg-platinum/40 text-foreground" },
  panel:         { label: "PANEL",         emoji: "🗣️", color: "bg-muted text-foreground" },
};

function formatDayHeader(dateStr: string | null, index: number) {
  if (!dateStr) return `Día ${index + 1} · Sin fecha`;
  const d = new Date(dateStr + "T00:00:00");
  const formatted = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `Día ${index + 1} · ${formatted.charAt(0).toUpperCase() + formatted.slice(1)}`;
}

export function groupAgendaByDay<T extends { event_date: string | null; time_start: string | null; order_index: number | null }>(items: T[]): Array<{ date: string | null; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const key = it.event_date ?? "__none__";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  const keys = Array.from(map.keys()).sort((a, b) => {
    if (a === "__none__") return 1;
    if (b === "__none__") return -1;
    return a.localeCompare(b);
  });
  return keys.map((k) => ({
    date: k === "__none__" ? null : k,
    items: map.get(k)!.slice().sort((x, y) => {
      const tx = x.time_start ?? "";
      const ty = y.time_start ?? "";
      if (tx !== ty) return tx.localeCompare(ty);
      return (x.order_index ?? 0) - (y.order_index ?? 0);
    }),
  }));
}

export function AgendaTable({ items }: { items: AgendaRow[] }) {
  if (!items.length) {
    return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Aún no hay agenda publicada.</div>;
  }
  const groups = groupAgendaByDay(items);
  return (
    <div className="space-y-6">
      {groups.map((g, gi) => (
        <div key={g.date ?? "none"} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="bg-primary/10 border-b border-border px-4 py-3">
            <div className="font-display text-sm font-bold text-uppercase-wide text-primary">{formatDayHeader(g.date, gi)}</div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-[10px] text-uppercase-wide text-muted-foreground">
                <th className="px-4 py-3">Horario</th>
                <th className="px-4 py-3">Actividad</th>
                <th className="px-4 py-3">Sala</th>
                <th className="px-4 py-3">Ponente</th>
              </tr>
            </thead>
            <tbody>
              {g.items.map((it, i) => {
                const meta = typeMeta[it.agenda_type ?? ""] ?? { label: "", emoji: "", color: "bg-muted" };
                return (
                  <tr key={it.id} className={i % 2 ? "bg-background" : "bg-card"}>
                    <td className="px-4 py-3 font-mono text-xs">{it.time_start?.slice(0,5)} – {it.time_end?.slice(0,5)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{it.title}</div>
                      {meta.label && (
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider ${meta.color}`}>
                          {meta.emoji} {meta.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {it.room && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />{it.room}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {it.speaker_name && <div className="font-medium">{it.speaker_name}</div>}
                      {it.speaker_role && <div className="text-muted-foreground">{it.speaker_role}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
