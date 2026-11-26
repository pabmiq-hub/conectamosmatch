import { describe, expect, it } from "vitest";
import {
  accountHasFreeResponsible,
  availableResponsibleIds,
  findMeetingConflict,
  firstFreeRoom,
  type MeetingAvailabilityRow,
} from "./meeting-availability";

const at = "2026-11-26T17:15:00.000Z";
const jaumeAtMesa15: MeetingAvailabilityRow = {
  scheduled_time: at,
  empresa_user_id: "empresa-1",
  sponsor_user_id: "jaume",
  room: "Mesa 15",
};
const parallel = { scheduled_time: at, empresa_user_id: "empresa-2", sponsor_user_id: "henry", room: "Mesa 16" };

describe("disponibilidad real por responsable y mesa", () => {
  it("permite otra reunión simultánea de ADP con Henry en Mesa 16 aunque Jaume esté en Mesa 15", () => {
    expect(findMeetingConflict([jaumeAtMesa15], parallel)).toBeNull();
  });

  it("bloquea a la misma persona de la solución aunque se elija otra mesa", () => {
    expect(findMeetingConflict([jaumeAtMesa15], { ...parallel, sponsor_user_id: "jaume" })).toBe("sponsor_person");
  });

  it("bloquea a la misma persona de la empresa en reuniones paralelas", () => {
    expect(findMeetingConflict([jaumeAtMesa15], { ...parallel, empresa_user_id: "empresa-1" })).toBe("empresa_person");
  });

  it("bloquea Mesa 15 aunque los dos responsables estén libres", () => {
    expect(findMeetingConflict([jaumeAtMesa15], { ...parallel, room: " mesa 15 " })).toBe("room");
  });

  it("mantiene ADP disponible porque Henry está libre aunque Jaume tenga reunión", () => {
    expect(availableResponsibleIds([jaumeAtMesa15], at, "sponsor", ["jaume", "henry"])).toEqual(["henry"]);
    const adp = { user_id: "jaume", responsables: [{ profile_id: "jaume" }, { profile_id: "henry" }] };
    expect(accountHasFreeResponsible(adp, new Set(["jaume"]))).toBe(true);
    expect(accountHasFreeResponsible(adp, new Set(["jaume", "henry"]))).toBe(false);
  });

  it("sugiere Mesa 16 cuando Mesa 15 ya está ocupada", () => {
    expect(firstFreeRoom([jaumeAtMesa15], at, ["Mesa 15", "Mesa 16"])).toBe("Mesa 16");
    expect(firstFreeRoom([jaumeAtMesa15, { ...jaumeAtMesa15, sponsor_user_id: "henry", room: "Mesa 16" }], at, ["Mesa 15", "Mesa 16"])).toBeNull();
  });
});
