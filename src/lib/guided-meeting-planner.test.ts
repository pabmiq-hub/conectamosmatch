import { describe, it, expect } from "vitest";
import { planMeetings, type PlanInput, type Unit, type Sponsor } from "./guided-meeting-planner";

const slots = ["a", "b", "c"].map((id, i) => ({ id, date: "2026-11-26", start: `18:${15 + i * 15}`, end: "", talk: false }));
const all = slots.map((s) => s.id);
const unit = (id: string, sel: string[], over: Partial<Unit> = {}): Unit => ({ id, members: [id], accountId: "E" + id, name: id, slots: all, selections: sel, mutual: [], maxMeetings: 8, ...over });
const sp = (id: string, over: Partial<Sponsor> = {}): Sponsor => ({ accountId: id, name: id, tier: "BASIC", guarantee: 10, tableCap: 1, reps: [{ userId: "r" + id, slots: all }], ...over });
const base = (over: Partial<PlanInput>): PlanInput => ({ slots, units: [], sponsors: [], minFreeOnTalk: 0, ...over });

describe("planificador guiado", () => {
  it("DRH con 1–6 selecciones recibe exactamente sus sponsors, aunque uno tenga el pack completo (extra protección)", () => {
    const r = planMeetings(base({ units: [unit("vf", ["X", "Y", "Z"])], sponsors: [sp("X"), sp("Y"), sp("Z", { guarantee: 0 })] }));
    expect(r.assignments.map((a) => a.sponsorId).sort()).toEqual(["X", "Y", "Z"]);
    expect(r.assignments.find((a) => a.sponsorId === "Z")?.kind).toBe("EXTRA_PROTECCION_DRH");
  });
  it("nunca asigna un sponsor no seleccionado", () => {
    const r = planMeetings(base({ units: [unit("d", ["X"])], sponsors: [sp("X"), sp("Y")] }));
    expect(r.assignments.map((a) => a.sponsorId)).toEqual(["X"]);
  });
  it("respeta vetos", () => {
    const r = planMeetings(base({ units: [unit("m", ["X", "Y"], { vetoes: ["X"] })], sponsors: [sp("X"), sp("Y")] }));
    expect(r.assignments.map((a) => a.sponsorId)).toEqual(["Y"]);
  });
  it("deja el mínimo de DRH libres en slots de Talk", () => {
    const talk = slots.map((s) => ({ ...s, talk: true }));
    const units = ["1", "2", "3"].map((id) => unit(id, ["X", "Y", "Z"]));
    const r = planMeetings(base({ slots: talk, units, sponsors: ["X", "Y", "Z"].map((x) => sp(x, { tableCap: 3, reps: [1, 2, 3].map((n) => ({ userId: x + n, slots: all })) })), minFreeOnTalk: 2 }));
    expect(r.slotReport.every((s) => s.free >= 2)).toBe(true);
  });
  it("una sesión conjunta cuenta 2 participaciones y una sola mesa", () => {
    const r = planMeetings(base({ units: [unit("consum", ["X"], { members: ["b", "a"] })], sponsors: [sp("X")] }));
    expect(r.sessions).toHaveLength(1);
    expect(r.sponsorReport[0]?.participations).toBe(2);
  });
  it("las unidades de un mismo grupo no repiten sponsor", () => {
    const r = planMeetings(base({ units: [unit("laia", ["X", "Y"], { disjointGroup: "g" }), unit("alexi", ["X", "Y"], { disjointGroup: "g" })], sponsors: [sp("X"), sp("Y")] }));
    expect(new Set(r.assignments.map((a) => a.sponsorId)).size).toBe(r.assignments.length);
  });
  it("en slots grupales dos DRH comparten una sesión del sponsor", () => {
    const r = planMeetings(base({ units: [unit("1", ["L"]), unit("2", ["L"])], sponsors: [sp("L", { groupSlots: ["a"] })], fixed: [{ unitId: "1", sponsorId: "L", slotId: "a" }] }));
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0]?.units).toEqual(["1", "2"]);
  });
  it("con representantes y mesas por slot no se solapan reuniones del mismo representante", () => {
    const r = planMeetings(base({ units: [unit("1", ["X"]), unit("2", ["X"]), unit("3", ["X"]), unit("4", ["X"])], sponsors: [sp("X")] }));
    expect(r.assignments).toHaveLength(3);
    expect(new Set(r.assignments.map((a) => a.slotId)).size).toBe(3);
  });
});
