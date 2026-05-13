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

export function AgendaTable({ items }: { items: AgendaRow[] }) {
  if (!items.length) {
    return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Aún no hay agenda publicada.</div>;
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
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
          {items.map((it, i) => {
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
  );
}
