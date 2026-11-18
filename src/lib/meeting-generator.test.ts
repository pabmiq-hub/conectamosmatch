import { describe, it, expect } from "vitest";
import { generateProposal, buildSlots, type GeneratorInput } from "./meeting-generator";

const m = (e: string, s: string, ea = "E" + e, sa = "S" + s) => ({ match_id: null, empresa_user_id: e, sponsor_user_id: s, empresa_account_id: ea, sponsor_account_id: sa });
const base = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  windows: [{ date: "2026-11-26", start: "17:30", end: "18:30" }], slotMinutes: 15, rooms: ["1A"], matches: [], availability: {}, accountCap: {}, existing: [], ...over,
});

describe("generador de reuniones", () => {
  it("divide la franja en huecos de la duración del slot", () => {
    expect(buildSlots(base().windows, 15).map((s) => s.start)).toEqual(["17:30", "17:45", "18:00", "18:15"]);
  });
  it("nadie tiene dos reuniones a la vez", () => {
    const r = generateProposal(base({ rooms: ["1A", "1B"], matches: [m("a", "x"), m("a", "y")] }));
    expect(r.proposals.map((p) => p.start)).toEqual(["17:30", "17:45"]);
  });
  it("respeta el tope de la cuenta", () => {
    const r = generateProposal(base({ matches: [m("a", "x"), m("a", "y")], accountCap: { Ea: 1 } }));
    expect(r.proposals).toHaveLength(1);
    expect(r.unassigned[0].reason).toMatch(/empresa/);
  });
  it("no usa franjas bloqueadas ni días sin asistencia", () => {
    const r = generateProposal(base({ matches: [m("a", "x"), m("b", "y")], availability: {
      "a|2026-11-26": { attends: true, blocked: [{ from: "17:30", to: "18:15" }], max: null },
      "y|2026-11-26": { attends: false, blocked: [], max: null },
    } }));
    expect(r.proposals).toHaveLength(1);
    expect(r.proposals[0].start).toBe("18:15");
    expect(r.unassigned).toHaveLength(1);
  });
  it("no reutiliza una mesa ocupada en el mismo hueco", () => {
    const r = generateProposal(base({ windows: [{ date: "2026-11-26", start: "17:30", end: "17:45" }], matches: [m("a", "x"), m("b", "y")] }));
    expect(r.proposals).toHaveLength(1);
  });
});
