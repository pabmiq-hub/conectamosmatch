import { describe, expect, it } from "vitest";
import { applyTalkExclusions, overlapsTalk, personAttendsTalk, type Talk } from "./talk-attendance";

const talk: Talk = { id: "Talk A", date: "2026-11-26", start: "18:15", end: "19:00", people: [
  { name: "Mireia Marimon", empresa: "Lacer" }, { name: "Otra persona", empresa: "Lacer" },
] };
describe("Quitar una persona de Talks para una reunión 1to1", () => {
  it("libera únicamente a la persona del Talk elegido", () => {
    const result = applyTalkExclusions([talk, { ...talk, id: "Talk B" }], [{ talk_id: "Talk A", person_name: "Mireia Marimon", company_name: "Lacer" }]);
    expect(result[0]?.people).toEqual([{ name: "Otra persona", empresa: "Lacer" }]);
    expect(result[1]?.people).toHaveLength(2);
    expect(talk.people).toHaveLength(2);
  });
  it("deja crear a las 18:30 tras quitarla, manteniendo el bloqueo de su compañero", () => {
    const active = applyTalkExclusions([talk], [{ talk_id: "Talk A", person_name: "Mireia Marimon", company_name: "Lacer" }]);
    const blocked = (name: string) => active.some((t) => personAttendsTalk(t, name, "Lacer") && overlapsTalk("2026-11-26T17:30:00Z", 15, t));
    expect(blocked("Mireia Marimon")).toBe(false);
    expect(blocked("Otra persona")).toBe(true);
  });
  it("no quita a un homónimo de otra empresa", () => {
    const result = applyTalkExclusions([{ ...talk, people: [...talk.people, { name: "Mireia Marimon", empresa: "Otra empresa" }] }], [{ talk_id: "Talk A", person_name: "Mireia Marimon", company_name: "Lacer" }]);
    expect(result[0]?.people).toContainEqual({ name: "Mireia Marimon", empresa: "Otra empresa" });
  });
  it("detecta solapes completos y respeta los extremos del Talk", () => {
    expect(overlapsTalk("2026-11-26T17:05:00Z", 15, talk)).toBe(true);
    expect(overlapsTalk("2026-11-26T17:00:00Z", 15, talk)).toBe(false);
    expect(overlapsTalk("2026-11-26T18:00:00Z", 15, talk)).toBe(false);
    expect(overlapsTalk("2026-11-27T17:30:00Z", 15, talk)).toBe(false);
  });
});