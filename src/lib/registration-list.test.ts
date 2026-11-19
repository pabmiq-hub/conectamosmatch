import { describe, expect, it } from "vitest";
import { filterAndSortRegistrations, roleCounts, roleLabel } from "./registration-list";

const r = (name: string, company: string, role: "empresa" | "sponsor") => ({
  attendee_name: name,
  attendee_company: company,
  role_at_event: role,
});

const ROWS = [
  r("Nuria Serrat", "Zalando", "sponsor"),
  r("Ana Ruiz", "Leroy Merlin", "empresa"),
  r("Pablo Miquel", "Acciona", "empresa"),
  r("Luis Vidal", "Vidext", "sponsor"),
];

describe("filtro de participantes", () => {
  it("«Todos» deja las cuatro filas", () => {
    expect(filterAndSortRegistrations(ROWS, { role: "all", field: "company", dir: "asc" })).toHaveLength(4);
  });
  it("«Empresas» deja solo las de empresa", () => {
    const out = filterAndSortRegistrations(ROWS, { role: "empresa", field: "company", dir: "asc" });
    expect(out.map((x) => x.attendee_company)).toEqual(["Acciona", "Leroy Merlin"]);
  });
  it("«Soluciones» deja solo las de solución", () => {
    const out = filterAndSortRegistrations(ROWS, { role: "sponsor", field: "company", dir: "asc" });
    expect(out.map((x) => x.attendee_company)).toEqual(["Vidext", "Zalando"]);
  });
  it("cuenta cada tipo por separado", () => {
    expect(roleCounts(ROWS)).toEqual({ all: 4, empresa: 2, sponsor: 2 });
  });
});

describe("orden alfabético", () => {
  it("por empresa, A→Z", () => {
    expect(
      filterAndSortRegistrations(ROWS, { role: "all", field: "company", dir: "asc" }).map((x) => x.attendee_company),
    ).toEqual(["Acciona", "Leroy Merlin", "Vidext", "Zalando"]);
  });
  it("por empresa, Z→A", () => {
    expect(
      filterAndSortRegistrations(ROWS, { role: "all", field: "company", dir: "desc" }).map((x) => x.attendee_company),
    ).toEqual(["Zalando", "Vidext", "Leroy Merlin", "Acciona"]);
  });
  it("por nombre, A→Z", () => {
    expect(
      filterAndSortRegistrations(ROWS, { role: "all", field: "name", dir: "asc" }).map((x) => x.attendee_name),
    ).toEqual(["Ana Ruiz", "Luis Vidal", "Nuria Serrat", "Pablo Miquel"]);
  });
  it("por nombre, Z→A", () => {
    expect(
      filterAndSortRegistrations(ROWS, { role: "all", field: "name", dir: "desc" }).map((x) => x.attendee_name),
    ).toEqual(["Pablo Miquel", "Nuria Serrat", "Luis Vidal", "Ana Ruiz"]);
  });
  it("ignora mayúsculas y acentos", () => {
    const rows = [r("Érci", "Ábaco", "empresa"), r("eres", "arce", "empresa"), r("ana", "Álamo", "empresa")];
    expect(filterAndSortRegistrations(rows, { role: "all", field: "company", dir: "asc" }).map((x) => x.attendee_company)).toEqual([
      "Ábaco",
      "Álamo",
      "arce",
    ]);
  });
  it("no altera el array original", () => {
    filterAndSortRegistrations(ROWS, { role: "all", field: "company", dir: "desc" });
    expect(ROWS[0].attendee_company).toBe("Zalando");
  });
});

describe("etiqueta del rol", () => {
  it("«sponsor» se lee «Solución» y «empresa» se lee «Empresa»", () => {
    expect(roleLabel({ role_at_event: "sponsor" })).toBe("Solución");
    expect(roleLabel({ role_at_event: "empresa" })).toBe("Empresa");
  });
});
