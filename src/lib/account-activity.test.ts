import { describe, it, expect } from "vitest";
import { countScheduledMeetings, uniquePartnerAccounts } from "./account-activity";

describe("account activity", () => {
  it("counts only scheduled non-cancelled meetings", () => {
    expect(countScheduledMeetings([
      { scheduled_time: null, status: "pending" },
      { scheduled_time: "2026-11-26T10:00:00Z", status: "confirmed" },
      { scheduled_time: "2026-11-26T11:00:00Z", status: "cancelled" },
    ])).toBe(1);
  });
  it("counts one match per account even with multiple representatives", () => {
    expect(uniquePartnerAccounts(["leeters", "leeters", "hastee", null])).toEqual(["leeters", "hastee"]);
  });
});