import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseAgendaText } from "./agenda-import";
const txt = `DÍA 01 – 26 DE NOVIEMBRE

16:30 A 17:00 | COFFEE BREAK

17:30 A 18:00 | CONVERSACIONES QUE CONSTRUYEN COMPROMISO Subtítulo: Cómo
Lacer transformó. Lugar: Auditorio
Turó del l’Home.

DÍA 02 – 27 DE NOVIEMBRE

08:00 A 09:00 | DESAYUNO + CHECK OUT Lugar: Recepción.`;
describe("parseAgendaText", () => {
  const r = parseAgendaText(txt, "2026-11-26");
  it("splits by day with real dates", () => {
    expect(r.map((x) => x.event_date)).toEqual(["2026-11-26", "2026-11-26", "2026-11-27"]);
  });
  it("extracts times, title, room and description across wrapped lines", () => {
    expect(r[1]).toMatchObject({ time_start: "17:30", time_end: "18:00", title: "CONVERSACIONES QUE CONSTRUYEN COMPROMISO", room: "Auditorio Turó del l’Home", description: "Subtítulo: Cómo Lacer transformó." });
    expect(r[0]!.agenda_type).toBe("coffee_break");
  });
});
