import { describe, expect, it } from "vitest";
import { matchEmails, parseEmailList, reciprocalPairs, retoPhase, validateWinners, winnerCandidates } from "./reto-admin";
import type { ScoreRow } from "./reto";

const row = (user_id: string, connections: number, bonus = 0): ScoreRow => ({
  user_id, display_name: user_id, company_name: null, participant_type: "drh", photo_url: null,
  connections, bonus, points: connections + bonus,
});

const NOW = Date.parse("2026-11-27T18:00:00Z");
const base = { is_active: true, emergency_off: false, is_closed: false, closes_at: null };

describe("estado del Reto", () => {
  it("abierto cuando está activo y sin hora de cierre", () => {
    expect(retoPhase(base, NOW)).toBe("abierto");
  });
  it("la emergencia manda sobre todo lo demás", () => {
    expect(retoPhase({ ...base, emergency_off: true, is_closed: true }, NOW)).toBe("emergencia");
  });
  it("cerrado tras «Cerrar ahora»", () => {
    expect(retoPhase({ ...base, is_closed: true }, NOW)).toBe("cerrado");
  });
  it("al pasar la hora de cierre deja de aceptar marcas", () => {
    expect(retoPhase({ ...base, closes_at: "2026-11-27T17:59:00Z" }, NOW)).toBe("cierre_pendiente");
    expect(retoPhase({ ...base, closes_at: "2026-11-27T18:01:00Z" }, NOW)).toBe("abierto");
  });
});

describe("ganadores", () => {
  it("Alma Conectamos excluye al Superconector", () => {
    const rows = [row("ana", 10, 0), row("bruno", 8, 1), row("carla", 3, 20)];
    const c = winnerCandidates(rows);
    expect(c.superTop.map((r) => r.user_id)).toEqual(["ana"]);
    expect(c.almaTop.map((r) => r.user_id)).toEqual(["carla"]);
  });
  it("muestra el empate en primer lugar en vez de decidirlo", () => {
    const rows = [row("ana", 10), row("bruno", 10), row("carla", 2)];
    const c = winnerCandidates(rows);
    expect(c.superTie).toBe(true);
    expect(c.almaTop).toEqual([]); // hasta elegir Superconector no se puede saber
  });
  it("tras el desempate, el otro empatado puede ser Alma", () => {
    const rows = [row("ana", 10), row("bruno", 10), row("carla", 2)];
    expect(winnerCandidates(rows, "ana").almaTop.map((r) => r.user_id)).toEqual(["bruno"]);
  });
  it("rechaza la misma persona en los dos premios", () => {
    const rows = [row("ana", 10), row("bruno", 5)];
    expect(validateWinners(rows, "ana", "ana")).toMatch(/distinta/);
  });
  it("rechaza un Superconector que no es el máximo", () => {
    const rows = [row("ana", 10), row("bruno", 5)];
    expect(validateWinners(rows, "bruno", null)).toMatch(/más conexiones/);
    expect(validateWinners(rows, "ana", "bruno")).toBeNull();
  });
});

describe("parejas y listados", () => {
  it("cuenta cada pareja recíproca una sola vez y solo entre participantes", () => {
    const marks = [
      { from: "a", to: "b", created_at: "2026-11-26T10:00:00Z" },
      { from: "b", to: "a", created_at: "2026-11-26T11:00:00Z" },
      { from: "a", to: "c" },
      { from: "c", to: "d" }, { from: "d", to: "c" },
    ];
    const pairs = reciprocalPairs(marks, new Set(["a", "b", "c"]));
    expect(pairs).toEqual([{ a: "a", b: "b", validated_at: "2026-11-26T11:00:00Z" }]);
  });
  it("lee emails de la columna «Email» y los empareja con usuarios", () => {
    const emails = parseEmailList([{ Nombre: "Ana", Email: " Ana@Test.com " }, { Nombre: "X", Email: "no-es-email" }]);
    expect(emails).toEqual(["ana@test.com"]);
    const m = matchEmails([...emails, "nadie@test.com"], [{ id: "1", email: "ana@test.com" }]);
    expect(m).toEqual({ found: ["1"], missing: ["nadie@test.com"] });
  });
});
