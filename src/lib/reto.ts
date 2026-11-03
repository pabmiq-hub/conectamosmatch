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

// ---------------------------------------------------------------------
// Fase 3 · Marcador colectivo y rankings
// ---------------------------------------------------------------------

export const RETO_MILESTONES = [900, 1800, 2700] as const;
export const RETO_LEVELS = [9, 27, 54] as const;

export type ScoreRow = {
  user_id: string;
  display_name: string;
  company_name: string | null;
  participant_type: string;
  photo_url: string | null;
  connections: number;
  bonus: number;
  points: number;
};

export type RankedRow = ScoreRow & { rank: number; value: number };

/**
 * Rank by a metric. Equal values share the same position (1, 1, 3…).
 * Display order inside a tie is stable (name, then id) and never changes the shared position.
 */
export function rankBy(rows: ScoreRow[], metric: "connections" | "points"): RankedRow[] {
  const sorted = [...rows].sort(
    (a, b) =>
      b[metric] - a[metric] ||
      a.display_name.localeCompare(b.display_name, "es") ||
      a.user_id.localeCompare(b.user_id),
  );
  let rank = 0;
  let prev: number | null = null;
  return sorted.map((r, i) => {
    if (r[metric] !== prev) { rank = i + 1; prev = r[metric]; }
    return { ...r, rank, value: r[metric] };
  });
}

/** Leaders: Superconector = most connections; Alma Conectamos = most points excluding the Superconector. */
export function pickLeaders(rows: ScoreRow[]) {
  const byConn = rankBy(rows, "connections").filter((r) => r.connections > 0);
  const superconector = byConn[0] ?? null;
  const superTie = !!superconector && byConn.filter((r) => r.rank === 1).length > 1;
  const byPts = rankBy(rows.filter((r) => r.user_id !== superconector?.user_id), "points").filter((r) => r.points > 0);
  const alma = byPts[0] ?? null;
  const almaTie = !!alma && byPts.filter((r) => r.rank === 1).length > 1;
  return { superconector, superTie, alma, almaTie };
}

/** Unique reciprocal pairs from per-person connection counts (each pair adds 1 to both members). */
export function collectiveFromRows(rows: ScoreRow[]): number {
  return Math.floor(rows.reduce((s, r) => s + r.connections, 0) / 2);
}

/** Highest threshold reached (0 if none). */
export function reachedThreshold(value: number, thresholds: readonly number[]): number {
  let hit = 0;
  for (const t of thresholds) if (value >= t) hit = t;
  return hit;
}

/** Next threshold not yet reached, or null. */
export function nextThreshold(value: number, thresholds: readonly number[]): number | null {
  return thresholds.find((t) => value < t) ?? null;
}

export async function fetchScoreboard(eventId: string): Promise<ScoreRow[]> {
  const { data, error } = await retoDb.rpc("reto_scoreboard", { _event: eventId });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    connections: Number(r.connections) || 0,
    bonus: Number(r.bonus) || 0,
    points: Number(r.points) || 0,
  }));
}

// ---------------------------------------------------------------------
// Fase 4 · Misiones y puntuación (todo se calcula en la base de datos)
// ---------------------------------------------------------------------

export type MissionRow = {
  mission_id: string;
  code: string;
  title: string;
  description: string | null;
  type: "connections" | "companies" | "cross_type" | "sprint" | "introduction";
  threshold: number;
  bonus_points: number;
  max_awards: number;
  starts_at: string | null;
  enabled: boolean;
  status: string;
  order_index: number;
  progress: number;
  unlocked: boolean;
  awarded_count: number;
  awarded_points: number;
  blocked_reason: string | null;
};

export type MissionState = "completada" | "en_curso" | "bloqueada";

/** Visual state of a mission for the participant. Points always come from the DB, never from here. */
export function missionState(m: Pick<MissionRow, "awarded_count" | "max_awards" | "blocked_reason">): MissionState {
  if (m.awarded_count > 0 && m.awarded_count >= m.max_awards) return "completada";
  if (m.blocked_reason) return m.awarded_count > 0 ? "completada" : "bloqueada";
  return m.awarded_count > 0 ? "completada" : "en_curso";
}

/** Progress ratio 0..1 capped at the threshold. */
export function missionRatio(progress: number, threshold: number): number {
  if (threshold <= 0) return 0;
  return Math.min(1, Math.max(0, progress / threshold));
}

/** Max bonus a mission can give (e.g. «Te presento»: 3 × 40 = 120). */
export function missionMaxBonus(m: Pick<MissionRow, "bonus_points" | "max_awards">): number {
  return m.bonus_points * m.max_awards;
}

export async function fetchMyMissions(eventId: string): Promise<MissionRow[]> {
  // Refresh first so missions unlocked by time are awarded; ignore if it fails (read still works).
  await retoDb.rpc("reto_refresh_missions", { _event: eventId }).then(() => null, () => null);
  const { data, error } = await retoDb.rpc("reto_my_missions", { _event: eventId });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    threshold: Number(r.threshold) || 0,
    bonus_points: Number(r.bonus_points) || 0,
    max_awards: Number(r.max_awards) || 1,
    progress: Number(r.progress) || 0,
    awarded_count: Number(r.awarded_count) || 0,
    awarded_points: Number(r.awarded_points) || 0,
  }));
}

export type PointsLogRow = { id: string; mission_code: string | null; delta: number; reason: "award" | "revoke"; detail: string | null; created_at: string };

export async function fetchMyPointsLog(eventId: string, userId: string): Promise<PointsLogRow[]> {
  const { data, error } = await retoDb
    .from("reto_points_log")
    .select("id, mission_code, delta, reason, detail, created_at")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}
