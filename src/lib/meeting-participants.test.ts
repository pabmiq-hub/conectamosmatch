import { describe, expect, it } from "vitest";
import { buildMeetingParticipants } from "./meeting-participants";

const member = (id: string, account: string, account_role = "manager", is_active = true) => ({ id, account_id: account, account_role, is_active, full_name: id, email: null });

describe("meeting participant accounts", () => {
  it("includes all 55 empresas and 23 soluciones regardless of legacy user_id", () => {
    for (const count of [55, 23]) {
      const accounts = Array.from({ length: count }, (_, i) => ({ id: `account-${i}`, user_id: null, company_name: `Cuenta ${i}` }));
      const members = accounts.map((a) => member(`owner-${a.id}`, a.id, "owner"));
      const result = buildMeetingParticipants(accounts, members, new Set(accounts.map((a) => a.id)));
      expect(result).toHaveLength(count);
      expect(result.every((a) => a.user_id === `owner-${a.account_id}`)).toBe(true);
    }
  });
  it("includes only accounts registered in the selected event", () => {
    expect(buildMeetingParticipants([
      { id: "current", user_id: null, company_name: "Actual" },
      { id: "other", user_id: null, company_name: "Otro evento" },
    ], [], new Set(["current"])).map((a) => a.account_id)).toEqual(["current"]);
  });
  it("resolves a stale owner and lists active teammates by account_id", () => {
    const result = buildMeetingParticipants([{ id: "A", user_id: "moved", company_name: "Empresa" }], [
      member("moved", "B"), member("teammate", "A"), member("owner", "A", "owner"), member("inactive", "A", "owner", false),
    ]);
    expect(result[0]?.user_id).toBe("owner");
    expect(result[0]?.responsables.map((r) => r.profile_id)).toEqual(["owner", "teammate"]);
  });
  it("keeps accounts without active members visible without assigning an invalid person", () => {
    expect(buildMeetingParticipants([{ id: "A", user_id: "inactive", company_name: "Empresa" }], [member("inactive", "A", "owner", false)])[0]).toMatchObject({ account_id: "A", user_id: null, responsables: [] });
  });
});