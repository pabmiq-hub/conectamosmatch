import { supabase } from "@/integrations/supabase/client";

// Reto 2.700 tables are not yet in the generated types; use an untyped client handle.
export const retoDb = supabase as any;

export type RetoStatus = "sin_conectar" | "por_confirmar" | "esperando" | "validada";

/**
 * Status of my relation with another participant.
 * A connection is only valid when both people have marked each other.
 */
export function connectionStatus(iMarkedThem: boolean, theyMarkedMe: boolean): RetoStatus {
  if (iMarkedThem && theyMarkedMe) return "validada";
  if (theyMarkedMe) return "por_confirmar";
  if (iMarkedThem) return "esperando";
  return "sin_conectar";
}

/** Count unique reciprocal pairs from a list of marks (each pair counted once). */
export function countReciprocalPairs(marks: { from: string; to: string }[]): number {
  const set = new Set(marks.map((m) => `${m.from}>${m.to}`));
  let n = 0;
  for (const m of marks) {
    if (m.from < m.to && set.has(`${m.to}>${m.from}`)) n++;
  }
  return n;
}

/** Returns the active Reto event id for the given user, or null. */
export async function getMyActiveRetoEvent(userId: string): Promise<string | null> {
  const { data: parts, error } = await retoDb
    .from("reto_participants")
    .select("event_id")
    .eq("user_id", userId);
  if (error || !parts?.length) return null;
  const ids = parts.map((p: any) => p.event_id);
  const { data: cfg } = await retoDb
    .from("reto_config")
    .select("event_id, is_active, emergency_off")
    .in("event_id", ids)
    .eq("is_active", true)
    .eq("emergency_off", false)
    .limit(1);
  return cfg?.[0]?.event_id ?? null;
}
