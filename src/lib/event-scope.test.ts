import { describe, expect, it } from "vitest";
import { pickCurrentEvent } from "./event-scope.server";

const NOW = new Date("2026-11-19T10:00:00Z").getTime();
const june = { id: "jun", status: "finished", event_date: "2026-06-11T11:00:00Z", end_date: null };
const nov = { id: "nov", status: "published", event_date: "2026-11-26T09:30:00Z", end_date: "2026-11-27T18:00:00Z" };

describe("pickCurrentEvent", () => {
  it("a participant registered in a finished and an upcoming event works in the upcoming one", () => {
    expect(pickCurrentEvent([june, nov], NOW)?.id).toBe("nov");
  });
  it("a participant only registered in the finished event keeps seeing that event", () => {
    expect(pickCurrentEvent([june], NOW)?.id).toBe("jun");
  });
  it("an event in progress wins over an upcoming one", () => {
    const live = { id: "live", status: "ongoing", event_date: "2026-11-19T08:00:00Z", end_date: null };
    expect(pickCurrentEvent([nov, live], NOW)?.id).toBe("live");
  });
  it("cancelled events are never picked", () => {
    expect(pickCurrentEvent([{ ...nov, status: "cancelled" }], NOW)).toBeNull();
  });
  it("no registrations means no event", () => {
    expect(pickCurrentEvent([], NOW)).toBeNull();
  });
});
