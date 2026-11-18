import { z } from "zod";

/** Modalidades de solución aceptadas (importación, edición y topes por evento). */
export const SPONSOR_LEVELS = ["PLATINUM", "GOLD", "SILVER", "BRONZE", "PREMIUM", "BASIC", "STARTUP"] as const;
export type SponsorLevel = (typeof SPONSOR_LEVELS)[number];

const ALIASES: Record<string, SponsorLevel> = {
  PLATINO: "PLATINUM", ORO: "GOLD", PLATA: "SILVER", BRONCE: "BRONZE", BASICO: "BASIC", BÁSICO: "BASIC",
};

export function normalizeSponsorLevel(v: unknown): SponsorLevel | undefined {
  if (v == null) return undefined;
  const s = String(v).trim().toUpperCase();
  if (!s) return undefined;
  if ((SPONSOR_LEVELS as readonly string[]).includes(s)) return s as SponsorLevel;
  return ALIASES[s];
}

export const sponsorLevelSchema = z.preprocess((v) => normalizeSponsorLevel(v) ?? (v === "" || v == null ? undefined : v), z.enum(SPONSOR_LEVELS));
