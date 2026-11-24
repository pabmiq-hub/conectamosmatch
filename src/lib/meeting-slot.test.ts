import { describe, it, expect } from "vitest";
import { getSlotInfo } from "./meeting-slot";
const w = [
  { event_date: "2026-11-26", time_start: "18:15:00", time_end: "19:45:00", agenda_type: "reuniones_1to1" },
  { event_date: "2026-11-27", time_start: "10:50:00", time_end: "12:50:00", agenda_type: "reuniones_1to1" },
];
describe("getSlotInfo", () => {
  it("Thursday 18:45 is Slot 3", () => expect(getSlotInfo("2026-11-26T17:45:00Z", 15, w)?.label).toBe("Slot 3 · 18:45 – 19:00"));
  it("Friday 10:50 is Slot 1", () => expect(getSlotInfo("2026-11-27T09:50:00Z", 15, w)?.number).toBe(1));
  it("outside a window keeps the time range only", () => expect(getSlotInfo("2026-11-26T09:00:00Z", 15, w)?.label).toBe("Slot · 10:00 – 10:15"));
});
