import { describe, it, expect } from "vitest";
import { resolveAccountOwner, accountLinkIssues } from "./account-owner";

const m = (id: string, acc: string | null, role = "manager", active = true) => ({ id, account_id: acc, account_role: role, is_active: active });

describe("resolveAccountOwner", () => {
  it("keeps a valid user_id", () => {
    expect(resolveAccountOwner({ id: "A", user_id: "u1" }, [m("u1", "A"), m("u2", "A", "owner")])).toBe("u1");
  });
  it("falls back to the active owner when user_id is empty", () => {
    expect(resolveAccountOwner({ id: "A", user_id: null }, [m("u2", "A"), m("u3", "A", "owner")])).toBe("u3");
  });
  it("falls back when user_id points to a missing profile", () => {
    expect(resolveAccountOwner({ id: "A", user_id: "ghost" }, [m("u2", "A")])).toBe("u2");
  });
  it("returns null when the account has no members", () => {
    expect(resolveAccountOwner({ id: "A", user_id: null }, [m("u9", "B")])).toBeNull();
  });
});

describe("accountLinkIssues", () => {
  it("flags missing responsable and no members", () => {
    expect(accountLinkIssues({ id: "A", user_id: null }, [])).toEqual(["sin_responsable", "sin_miembros"]);
  });
  it("flags a broken responsable", () => {
    expect(accountLinkIssues({ id: "A", user_id: "ghost" }, [m("u1", "A")])).toEqual(["responsable_roto"]);
  });
  it("no issues when linked", () => {
    expect(accountLinkIssues({ id: "A", user_id: "u1" }, [m("u1", "A")])).toEqual([]);
  });
});
