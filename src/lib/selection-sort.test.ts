import { describe, expect, it } from "vitest";
import { SELECTION_SORT_OPTIONS, sortSelectionAccounts, targetSortDir } from "./selection-sort";

const accounts = [
  { company_name: "ADP", total: 18 },
  { company_name: "Leroy Merlin", total: 9 },
  { company_name: "Hastee", total: 0 },
  { company_name: "Vidext", total: 18 },
];

describe("sortSelectionAccounts", () => {
  it("ordena alfabéticamente ascendente y descendente", () => {
    expect(sortSelectionAccounts(accounts, "name_asc").map((a) => a.company_name)).toEqual([
      "ADP",
      "Hastee",
      "Leroy Merlin",
      "Vidext",
    ]);
    expect(sortSelectionAccounts(accounts, "name_desc").map((a) => a.company_name)).toEqual([
      "Vidext",
      "Leroy Merlin",
      "Hastee",
      "ADP",
    ]);
  });

  it("pone primero las cuentas con más selecciones", () => {
    expect(sortSelectionAccounts(accounts, "total_desc").map((a) => a.total)).toEqual([18, 18, 9, 0]);
  });

  it("pone primero las cuentas con menos selecciones", () => {
    expect(sortSelectionAccounts(accounts, "total_asc").map((a) => a.total)).toEqual([0, 9, 18, 18]);
  });

  it("desempata las cuentas con el mismo total por orden alfabético", () => {
    expect(sortSelectionAccounts(accounts, "total_desc").map((a) => a.company_name)).toEqual([
      "ADP",
      "Vidext",
      "Leroy Merlin",
      "Hastee",
    ]);
    expect(sortSelectionAccounts(accounts, "total_asc").map((a) => a.company_name)).toEqual([
      "Hastee",
      "Leroy Merlin",
      "ADP",
      "Vidext",
    ]);
  });

  it("no muta la lista original y tolera totales y nombres vacíos", () => {
    const before = accounts.map((a) => a.company_name);
    const sorted = sortSelectionAccounts(
      [{ company_name: null, total: null }, { company_name: "Zeta", total: 3 }, { company_name: "Alda", total: 3 }],
      "total_desc",
    );
    expect(sorted.map((a) => a.company_name)).toEqual(["Alda", "Zeta", null]);
    expect(accounts.map((a) => a.company_name)).toEqual(before);
  });

  it("mantiene las cuatro opciones del selector", () => {
    expect(SELECTION_SORT_OPTIONS.map((o) => o.key)).toEqual(["name_asc", "name_desc", "total_desc", "total_asc"]);
  });

  it("las fichas solo invierten su orden alfabético con Z→A", () => {
    expect(targetSortDir("name_asc")).toBe("asc");
    expect(targetSortDir("name_desc")).toBe("desc");
    expect(targetSortDir("total_desc")).toBe("asc");
    expect(targetSortDir("total_asc")).toBe("asc");
  });
});
