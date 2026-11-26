import { getSlotInfo } from "@/lib/meeting-slot";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AgendaRow = Database["public"]["Tables"]["event_agenda"]["Row"];

export type AgendaMeeting = {
  id: string;
  scheduled_time: string | null;
  partner_name: string | null;
  my_attendee: string | null;
  responsable: string | null;
  responsable_role: string | null;
  room: string | null;
  duration_minutes?: number | null;
};

const typeMeta: Record<string, { label: string; emoji: string; color: string }> = {
  bienvenida:    { label: "BIENVENIDA",    emoji: "👋", color: "bg-muted text-foreground" },
  charla:        { label: "CHARLA",        emoji: "🎤", color: "bg-primary/20 text-primary" },
  networking:    { label: "NETWORKING",    emoji: "🤝", color: "bg-success/20 text-success" },
  coffee_break:  { label: "COFFEE BREAK",  emoji: "☕", color: "bg-bronze/30 text-foreground" },
  comida:        { label: "COMIDA",        emoji: "🍽️", color: "bg-bronze/30 text-foreground" },
  reuniones_1to1:{ label: "REUNIONES 1TO1",emoji: "📅", color: "bg-primary text-primary-foreground" },
  actividad_recreativa:{ label: "ACTIVIDAD RECREATIVA", emoji: "🎉", color: "bg-accent text-accent-foreground" },
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

function meetingMadridDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  return y && m && day ? `${y}-${m}-${day}` : null;
}

function meetingTimeLabel(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}

export function AgendaTable({ items, meetings = [] }: { items: AgendaRow[]; meetings?: AgendaMeeting[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (!items.length) {
    return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Aún no hay agenda publicada.</div>;
  }
  const groups = groupAgendaByDay(items);

  const meetingsByDate = new Map<string, AgendaMeeting[]>();
  for (const m of meetings) {
    const key = meetingMadridDate(m.scheduled_time) ?? "__none__";
    if (!meetingsByDate.has(key)) meetingsByDate.set(key, []);
    meetingsByDate.get(key)!.push(m);
  }
  for (const arr of meetingsByDate.values()) {
    arr.sort((a, b) => (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? ""));
  }

  const toggle = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="space-y-8">
      {groups.map((g, gi) => (
        <section key={g.date ?? "none"}>
          <h3 className="mb-4 font-display text-sm font-bold text-uppercase-wide text-primary">{formatDayHeader(g.date, gi)}</h3>
          <ol className="relative space-y-3 border-l-2 border-primary/20 pl-4 sm:pl-6">
            {g.items.map((it) => {
              const meta = typeMeta[it.agenda_type ?? ""] ?? { label: "", emoji: "", color: "bg-muted" };
              const dayMeetings = it.agenda_type === "reuniones_1to1" && g.date ? meetingsByDate.get(g.date) ?? [] : [];
              const desc = (it.description ?? "").trim();
              const lines = desc ? desc.split(/\n+/).map((l) => l.trim()).filter(Boolean) : [];
              const summary = lines[0] ?? "";
              const rest = lines.slice(1);
              const longSummary = summary.length > 160;
              const hasDetails = rest.length > 0 || longSummary || dayMeetings.length > 0 || !!it.speaker_role;
              const isOpen = !!expanded[it.id];
              return (
                <li key={it.id} className="relative">
                  <span className="absolute -left-[23px] top-5 h-3 w-3 rounded-full border-2 border-primary bg-background sm:-left-[31px]" />
                  <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">{it.time_start?.slice(0,5)} – {it.time_end?.slice(0,5)}</span>
                      {meta.label && (
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider ${meta.color}`}>{meta.emoji} {meta.label}</span>
                      )}
                    </div>
                    <h4 className="mt-2 break-words font-display text-base font-semibold leading-snug">{it.title}</h4>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {it.room && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />{it.room}</span>}
                      {it.speaker_name && <span className="font-medium text-foreground">🎙️ {it.speaker_name}</span>}
                    </div>
                    {summary && (
                      <p className={`mt-2 break-words text-sm text-muted-foreground ${longSummary && !isOpen ? "line-clamp-2" : ""}`}>{summary}</p>
                    )}
                    {hasDetails && (
                      <button
                        type="button"
                        onClick={() => toggle(it.id)}
                        aria-expanded={isOpen}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {isOpen ? "Ocultar detalles" : dayMeetings.length > 0 ? `Ver detalles y tus ${dayMeetings.length} reuniones` : "Ver detalles"}
                      </button>
                    )}
                    {hasDetails && isOpen && (
                      <div className="mt-3 space-y-3 border-t border-border pt-3">
                        {it.speaker_role && (
                          <div className="text-xs"><span className="font-medium">{it.speaker_name}</span>{it.speaker_name ? " · " : ""}<span className="text-muted-foreground">{it.speaker_role}</span></div>
                        )}
                        {rest.length > 0 && (
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {rest.map((l, li) => <li key={li} className="break-words">{l}</li>)}
                          </ul>
                        )}
                        {dayMeetings.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-[10px] font-bold text-uppercase-wide text-primary">Tus reuniones 1to1 ({dayMeetings.length})</div>
                            <div className="grid gap-2">
                              {dayMeetings.map((m) => (
                                <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-primary/5 px-3 py-2 text-xs">
                                  <span className="font-mono font-bold text-primary">{meetingTimeLabel(m.scheduled_time)}</span>
                                  {(() => { const si = getSlotInfo(m.scheduled_time, m.duration_minutes, items); return si?.number ? <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">{si.label}</span> : null; })()}
                                  <span className="font-medium">{m.partner_name ?? "—"}</span>
                                  {m.responsable && <span className="text-muted-foreground">· {m.responsable}</span>}
                                  {m.my_attendee && <span className="text-muted-foreground">· Asiste: {m.my_attendee}</span>}
                                  {m.room && <span className="text-muted-foreground">· Mesa {m.room}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
