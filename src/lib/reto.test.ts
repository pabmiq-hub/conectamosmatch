import { describe, expect, it } from "vitest";
import { connectionStatus, countReciprocalPairs } from "./reto";

describe("Reto 2.700 reciprocity", () => {
  it("A marks B only → 0 connections", () => {
    expect(countReciprocalPairs([{ from: "a", to: "b" }])).toBe(0);
  });
  it("A marks B and B marks A → 1 connection", () => {
    expect(countReciprocalPairs([{ from: "a", to: "b" }, { from: "b", to: "a" }])).toBe(1);
  });
  it("after unmarking, back to 0", () => {
    expect(countReciprocalPairs([{ from: "b", to: "a" }])).toBe(0);
  });
  it("statuses from my point of view", () => {
    expect(connectionStatus(true, false)).toBe("esperando");
    expect(connectionStatus(false, true)).toBe("por_confirmar");
    expect(connectionStatus(true, true)).toBe("validada");
    expect(connectionStatus(false, false)).toBe("sin_conectar");
  });
});
