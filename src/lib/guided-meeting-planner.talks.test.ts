import { describe, it, expect } from "vitest";
import { reserveTalks, planMeetings, type Unit, type PSlot } from "./guided-meeting-planner";

const slots: PSlot[] = ["a", "b", "c", "d", "e", "f"].map((x, i) => ({ id: `2026-11-26 0${i}`, date: "2026-11-26", start: x, end: x, talk: false }));
const ids = slots.map((s) => s.id);
const mk = (n: number): Unit[] => Array.from({ length: n }, (_, i) => ({ id: `u${i}`, members: [`u${i}`], accountId: `acc${i}`, name: `U${i}`, slots: ids, selections: ["sp"], mutual: ["sp"], maxMeetings: 3 }));

describe("reserveTalks (v19)", () => {
  it("reserva 20 DRH distintos por Talk y ninguno tiene reunión en sus 3 slots", () => {
    const talks = [{ id: "A", slotIds: ids.slice(0, 3) }, { id: "B", slotIds: ids.slice(3) }];
    const r = reserveTalks(mk(45), talks, 20, () => true);
    expect(r.reserved.get("A")).toHaveLength(20);
    expect(r.reserved.get("B")).toHaveLength(20);
    expect(new Set([...r.reserved.get("A")!, ...r.reserved.get("B")!]).size).toBe(40);
    const plan = planMeetings({ slots, units: r.units, sponsors: [{ accountId: "sp", name: "S", tier: "GOLD", guarantee: 45, tableCap: 45, reps: Array.from({ length: 45 }, (_, i) => ({ userId: `r${i}`, slots: ids })) }], minFreeOnTalk: 0 });
    for (const t of talks) for (const u of r.reserved.get(t.id)!) expect(plan.assignments.some((a) => a.unitId === u && t.slotIds.includes(a.slotId))).toBe(false);
  });
  it("avisa si no llega a 20 en vez de bajar el mínimo", () => {
    const r = reserveTalks(mk(15), [{ id: "A", slotIds: ids.slice(0, 3) }], 20, () => true);
    expect(r.issues[0]?.reason).toContain("solo 15");
  });
});
