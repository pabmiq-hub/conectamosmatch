import { describe, expect, it } from "vitest";
import { featuredSolutionIds, sortSolutions } from "./featured-solutions";

const items = [
  { id: "z", company_name: "Zeta" }, { id: "b", company_name: "Beta" },
  { id: "a", company_name: "Álamo" }, { id: "d", company_name: "Delta" },
];
describe("event solution highlights", () => {
  it("uses only highlights of the selected event", () => {
    const rows = [{ event_id: "one", sponsor_account_id: "z" }, { event_id: "two", sponsor_account_id: "a" }];
    expect([...featuredSolutionIds(rows, "one")]).toEqual(["z"]);
    expect([...featuredSolutionIds(rows, "two")]).toEqual(["a"]);
    expect([...featuredSolutionIds(rows, null)]).toEqual([]);
  });
  it("defaults to alphabetical order, not selection totals", () => {
    expect(sortSolutions(items, new Set()).map((s) => s.id)).toEqual(["a", "b", "d", "z"]);
  });
  it("puts highlighted solutions first with alphabetical order in both groups", () => {
    expect(sortSolutions(items, new Set(["z", "b"])).map((s) => s.id)).toEqual(["b", "z", "a", "d"]);
  });
  it("keeps highlights first when reversing alphabetical order", () => {
    expect(sortSolutions(items, new Set(["z", "b"]), "desc").map((s) => s.id)).toEqual(["z", "b", "d", "a"]);
  });
  it("restores normal alphabetical position when the star is removed", () => {
    expect(sortSolutions(items, new Set(["b"])).map((s) => s.id)).toEqual(["b", "a", "d", "z"]);
  });
});