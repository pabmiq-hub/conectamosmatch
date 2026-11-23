import { describe, it, expect } from "vitest";
import { receivedInterest, randomRanks, sortDirectory } from "./directory-order";

const items = [{ id: "a", company_name: "ADP" }, { id: "z", company_name: "Vidext" }, { id: "m", company_name: "Marlex" }];
const counts = { a: 2, z: 0, m: 7 };
describe("independent event directory ordering", () => {
  it("alphabetical is A–Z, not interest order", () => {
    expect(sortDirectory(items, { mode: "alphabetical", counts }).map((x) => x.id)).toEqual(["a", "m", "z"]);
  });
  it("most received interest first", () => {
    expect(sortDirectory(items, { mode: "most_interest", counts }).map((x) => x.id)).toEqual(["m", "a", "z"]);
  });
  it("least received interest includes zero first", () => {
    expect(sortDirectory(items, { mode: "least_interest", counts }).map((x) => x.id)).toEqual(["z", "a", "m"]);
  });
  for (const mode of ["alphabetical", "most_interest", "least_interest", "random"] as const) {
    it(`featured stays first in ${mode}`, () => {
      expect(sortDirectory(items, { mode, counts }, new Set(["z"]), { a: 0, m: 1, z: 2 }).map((x) => x.id)[0]).toBe("z");
    });
  }
  it("random shuffles without dropping items and stays stable while filtering", () => {
    const ranks = randomRanks(["a", "m", "z"], () => 0);
    expect(sortDirectory(items, { mode: "random", counts }, new Set(), ranks).map((x) => x.id)).toEqual(["m", "z", "a"]);
    expect(sortDirectory(items.filter((x) => x.id !== "z"), { mode: "random", counts }, new Set(), ranks).map((x) => x.id)).toEqual(["m", "a"]);
  });
  it("counts unique incoming accounts, ignores self and non-event accounts", () => {
    const profiles = [{ id: "p1", account_id: "a" }, { id: "p2", account_id: "a" }, { id: "p3", account_id: "m" }, { id: "p4", account_id: "outside" }];
    expect(receivedInterest([
      { from_user_id: "p1", to_user_id: "p3" }, { from_user_id: "p2", to_user_id: "p3" },
      { from_user_id: "p3", to_user_id: "p3" }, { from_user_id: "p4", to_user_id: "p3" },
    ], profiles, new Set(["a", "m", "z"]))).toEqual({ a: 0, m: 1, z: 0 });
  });
  it("company and solution modes are independent", () => {
    expect(sortDirectory(items, { mode: "least_interest", counts }).map((x) => x.id)).toEqual(["z", "a", "m"]);
    expect(sortDirectory(items, { mode: "most_interest", counts }).map((x) => x.id)).toEqual(["m", "a", "z"]);
  });
});