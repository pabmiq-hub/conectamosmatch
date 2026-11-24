export type AgendaType = "bienvenida" | "charla" | "panel" | "coffee_break" | "comida" | "networking" | "reuniones_1to1" | "cierre";
export type ParsedAgendaItem = {
  day_index: number; event_date: string | null; time_start: string; time_end: string;
  title: string; description: string; room: string; agenda_type: AgendaType; order_index: number;
};
const MONTHS: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

export function classifyAgenda(text: string): AgendaType {
  const t = text.toLowerCase();
  if (/one 2 one|1to1|1 to 1|one2one|1:1/.test(t)) return "reuniones_1to1";
  if (/coffee|café/.test(t)) return "coffee_break";
  if (/acreditaci|apertura|bienvenida/.test(t)) return "bienvenida";
  if (/cena|comida|almuerzo|desayuno/.test(t)) return "comida";
  if (/cierre|shuttle|check out|despedida/.test(t)) return "cierre";
  if (/networking|cóctel|coctel|show|premios/.test(t)) return "networking";
  if (/mesa inaugural|mesa redonda|panel/.test(t)) return "panel";
  return "charla";
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Parses the standard text agenda. `startDate` (YYYY-MM-DD) = event day 1. */
export function parseAgendaText(text: string, startDate: string | null): ParsedAgendaItem[] {
  const year = startDate ? Number(startDate.slice(0, 4)) : new Date().getFullYear();
  const blocks = text.replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.split("\n").map((l) => l.trim()).join(" ").trim()).filter(Boolean);
  const items: ParsedAgendaItem[] = [];
  let day = 0; let date: string | null = startDate; let order = 0;
  for (const b of blocks) {
    const dh = b.match(/^D[IÍ]A\s*0*(\d+)(?:\s*[–\-:]\s*(\d{1,2})\s+DE\s+([A-Za-zÁÉÍÓÚáéíóú]+))?/i);
    if (dh && !b.includes("|")) {
      day = Number(dh[1]); order = 0;
      const m = dh[3] ? MONTHS[dh[3].toLowerCase()] : undefined;
      date = dh[2] && m ? `${year}-${pad(m)}-${pad(Number(dh[2]))}` : startDate ? addDays(startDate, day - 1) : null;
      continue;
    }
    const em = b.match(/^(\d{1,2})[:.](\d{2})\s*(?:A|-|–)\s*(\d{1,2})[:.](\d{2})\s*\|\s*(.+)$/i);
    if (!em) continue;
    let rest = em[5]!.trim(); let room = "";
    const lm = rest.match(/\s*Lugar:\s*(.+?)\.?\s*$/i);
    if (lm) { room = lm[1]!.trim(); rest = rest.slice(0, lm.index).trim(); }
    const tokens = rest.split(/\s+/); let i = 0;
    while (i < tokens.length && !/[a-zà-ÿ]/.test(tokens[i]!)) i++;
    const title = tokens.slice(0, i).join(" ").replace(/[\s+,:\-–]+$/, "") || rest;
    const description = tokens.slice(i).join(" ");
    items.push({
      day_index: day || 1, event_date: date,
      time_start: `${pad(Number(em[1]))}:${em[2]}`, time_end: `${pad(Number(em[3]))}:${em[4]}`,
      title, description, room, agenda_type: classifyAgenda(title + " " + description), order_index: order++,
    });
  }
  return items;
}
