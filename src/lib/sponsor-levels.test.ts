import { describe, it, expect } from "vitest";
import { normalizeSponsorLevel } from "./sponsor-levels";
describe("normalizeSponsorLevel", () => {
  it("acepta Platinum/Gold/Silver en cualquier formato", () => {
    expect(normalizeSponsorLevel(" platinum ")).toBe("PLATINUM");
    expect(normalizeSponsorLevel("Plata")).toBe("SILVER");
    expect(normalizeSponsorLevel("oro")).toBe("GOLD");
  });
  it("vacío o desconocido no es modalidad", () => {
    expect(normalizeSponsorLevel("")).toBeUndefined();
    expect(normalizeSponsorLevel("Diamante")).toBeUndefined();
  });
});
