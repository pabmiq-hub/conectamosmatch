import { describe, expect, it } from "vitest";
import { getParticipantSelections, type SelectionAccount, type SelectionTarget } from "./participant-selections";

const target = (id: string, names: string[] = ["Ana"]): SelectionTarget => ({ account_id: id, company_name: id, kind: "empresa", responsables: names, created_at: "2026-11-21T09:00:00Z" });
const account = (id: string, targets: SelectionTarget[] = []): SelectionAccount => ({ account_id: id, company_name: id, kind: "sponsor", logo_url: `/logos/${id}.png`, targets });

describe("participant selection detail", () => {
  it("counts unique partner accounts even when multiple people selected them", () => {
    const result = getParticipantSelections([account("ADP", [target("Empresa", ["Henry"]), target("Empresa", ["Sara"])])], ["ADP"]);
    expect(result.outgoing).toHaveLength(1);
    expect(result.outgoing[0]?.responsables).toEqual(["Henry", "Sara"]);
  });
  it("shows incoming interest without a reciprocal selection", () => {
    const result = getParticipantSelections([account("ADP"), account("Empresa", [target("ADP", ["Pablo"])])], ["ADP"]);
    expect(result.incoming.map((entry) => entry.company_name)).toEqual(["Empresa"]);
    expect(result.incoming[0]?.responsables).toEqual(["Pablo"]);
    expect(result.incoming[0]?.logo_url).toBe("/logos/Empresa.png");
    expect(result.incoming[0]?.mutual).toBe(false);
    expect(result.matches).toBe(0);
  });
  it("marks a match only when both accounts selected each other", () => {
    const result = getParticipantSelections([account("ADP", [target("Empresa")]), account("Empresa", [target("ADP")])], ["ADP"]);
    expect(result.matches).toBe(1);
    expect(result.outgoing[0]?.mutual).toBe(true);
    expect(result.incoming[0]?.mutual).toBe(true);
  });
  it("keeps equally named accounts separate by ID", () => {
    const result = getParticipantSelections([account("ADP", [{ ...target("a"), company_name: "Igual" }, { ...target("b"), company_name: "Igual" }])], ["ADP"]);
    expect(result.outgoing).toHaveLength(2);
  });
  it("orders both columns alphabetically", () => {
    const result = getParticipantSelections([account("ADP", [target("Zeta"), target("Alfa")]), account("Zeta", [target("ADP")]), account("Alfa", [target("ADP")])], ["ADP"]);
    expect(result.outgoing.map((entry) => entry.company_name)).toEqual(["Alfa", "Zeta"]);
    expect(result.incoming.map((entry) => entry.company_name)).toEqual(["Alfa", "Zeta"]);
  });
  it("combines grouped account IDs without counting internal selections", () => {
    const result = getParticipantSelections([account("a", [target("b"), target("Empresa")]), account("b", [target("Empresa")])], ["a", "b"]);
    expect(result.outgoing.map((entry) => entry.account_id)).toEqual(["Empresa"]);
  });
  it("returns zero counts for an account with no selections", () => {
    expect(getParticipantSelections([account("ADP")], ["ADP"])).toEqual({ outgoing: [], incoming: [], matches: 0 });
  });
});