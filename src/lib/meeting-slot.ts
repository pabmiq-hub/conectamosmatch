export type SlotWindow = { event_date: string | null; time_start: string | null; time_end?: string | null; agenda_type?: string | null };
export type SlotInfo = { number: number | null; start: string; end: string; label: string; short: string };

function madridParts(iso: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const h = Number(g("hour")) % 24;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, minutes: h * 60 + Number(g("minute")) };
}
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Slot number counts from the start of the day's 1to1 agenda window (Slot 1 = first 15 min). */
export function getSlotInfo(scheduledIso: string | null | undefined, durationMin: number | null | undefined, windows: SlotWindow[] = []): SlotInfo | null {
  if (!scheduledIso) return null;
  const dur = durationMin && durationMin > 0 ? durationMin : 15;
  const { date, minutes } = madridParts(scheduledIso);
  const win = windows
    .filter((w) => (w.agenda_type == null || w.agenda_type === "reuniones_1to1") && w.time_start && w.event_date?.slice(0, 10) === date)
    .find((w) => { const s = toMin(w.time_start!); const e = w.time_end ? toMin(w.time_end) : 24 * 60; return minutes >= s && minutes < e; });
  const number = win ? Math.floor((minutes - toMin(win.time_start!)) / dur) + 1 : null;
  const start = fmt(minutes), end = fmt(minutes + dur);
  const short = number ? `Slot ${number}` : "Slot";
  return { number, start, end, short, label: `${short} · ${start} – ${end}` };
}
