import { beforeEach, describe, expect, it, vi } from "vitest";
import base from "@/data/talks-conectamos27h.json";
import type { TalkExclusion } from "./talk-attendance";

const mocks = vi.hoisted(() => ({ role: vi.fn(), from: vi.fn(), save: vi.fn(), range: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { listEventTalks, removeTalkPerson } from "./admin-talks.functions";

const context = { userId: "admin", supabase: { rpc: mocks.role, from: mocks.from } };
const list = listEventTalks as unknown as (args: { data: { event_id: string }; context: typeof context }) => Promise<{ talks: typeof base.talks }>;
const remove = removeTalkPerson as unknown as (args: { data: TalkExclusion & { event_id: string }; context: typeof context }) => Promise<{ ok: boolean }>;
const firstTalk = base.talks[0];
const firstPerson = firstTalk?.people[0];
if (!firstTalk || !firstPerson) throw new Error("Test requires a real planner Talk assignment");
const removal = { event_id: base.eventId, talk_id: firstTalk.id, person_name: firstPerson.name, company_name: firstPerson.empresa };
let stored: TalkExclusion[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  stored = [];
  mocks.role.mockResolvedValue({ data: true, error: null });
  mocks.save.mockImplementation(async (row: typeof removal) => { stored.push(row); return { error: null }; });
  mocks.range.mockImplementation(async () => ({ data: stored, error: null }));
  const query = { select: () => query, eq: () => query, order: () => query, range: mocks.range, upsert: mocks.save };
  mocks.from.mockReturnValue(query);
});

describe("Talk attendance administration", () => {
  it("saves only an exclusion and reads back the removed attendance", async () => {
    const before = await list({ data: { event_id: base.eventId }, context });
    await expect(remove({ data: removal, context })).resolves.toEqual({ ok: true });
    const after = await list({ data: { event_id: base.eventId }, context });
    expect(after.talks[0]?.people.length).toBe((before.talks[0]?.people.length ?? 0) - 1);
    expect(after.talks[0]?.people).not.toContainEqual(firstPerson);
    expect(after.talks.slice(1)).toEqual(before.talks.slice(1));
    expect(mocks.save).toHaveBeenCalledWith({ ...removal, removed_by: "admin" }, expect.objectContaining({ ignoreDuplicates: true }));
    expect(mocks.from.mock.calls.every(([table]) => table === "event_talk_exclusions")).toBe(true);
  });
  it("rejects another event without writing attendance or meetings", async () => {
    await expect(remove({ data: { ...removal, event_id: "00000000-0000-4000-8000-000000000001" }, context })).rejects.toThrow("no está asignada");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects participants before reading or removing assignments", async () => {
    mocks.role.mockResolvedValue({ data: false, error: null });
    await expect(remove({ data: removal, context })).rejects.toThrow("superadministradores");
    await expect(list({ data: { event_id: base.eventId }, context })).rejects.toThrow("superadministradores");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not report a successful removal if saving fails", async () => {
    mocks.save.mockResolvedValue({ error: { message: "database unavailable" } });
    await expect(remove({ data: removal, context })).rejects.toThrow("No se ha podido quitar");
    expect(stored).toEqual([]);
  });
});