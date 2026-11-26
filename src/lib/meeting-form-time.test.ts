import { describe, expect, it } from "vitest";
import { resolveMeetingFormTime } from "./meeting-form-time";

const friday1120 = "2026-11-27T10:20:00.000Z";
describe("meeting form time", () => {
  it("saves Friday 11:20 Madrid when selected in either slot control", () => {
    expect(resolveMeetingFormTime(friday1120, "", [{ iso: friday1120, free: true }])).toBe("2026-11-27T10:20:00.000Z");
  });
  it("cannot silently create an unscheduled meeting while a selected slot is loading", () => {
    expect(() => resolveMeetingFormTime(friday1120, "", null)).toThrow();
  });
  it("cannot create in a slot that became occupied after changing a participant", () => {
    expect(() => resolveMeetingFormTime(friday1120, "", [{ iso: friday1120, free: false }])).toThrow();
  });
  it("cannot silently discard a selected slot missing from availability", () => {
    expect(() => resolveMeetingFormTime(friday1120, "", [])).toThrow();
  });
  it("keeps intentional unscheduled drafts when neither control has a time", () => {
    expect(resolveMeetingFormTime("", "", [])).toBeNull();
  });
  it("allows a manually entered alternative time", () => {
    expect(resolveMeetingFormTime("", "2026-11-27T10:20:00Z", [])).toBe(friday1120);
  });
});