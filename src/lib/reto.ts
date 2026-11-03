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

// ---------------------------------------------------------------------
// Fase 5 · «¡Te presento!» (validación y puntos siempre en la base de datos)
// ---------------------------------------------------------------------

export const INTRO_MAX = 3;
export const INTRO_POINTS = 40;

export type IntroRow = {
  id: string;
  introducer_id: string;
  person_a: string;
  person_b: string;
  a_confirmed: boolean;
  b_confirmed: boolean;
  pair_connected: boolean;
  status: "pending" | "validated" | "cancelled" | "declined";
  awarded: boolean;
  created_at: string;
  validated_at: string | null;
};

/** Client-side pre-check of a pick (the DB repeats every check). Returns an error message or null. */
export function introPickError(me: string, p1: string | null, p2: string | null): string | null {
  if (!p1 || !p2) return "Elige dos personas";
  if (p1 === p2) return "Elige dos personas distintas";
  if (p1 === me || p2 === me) return "No puedes presentarte a ti mismo";
  return null;
}

/** Open slots left for a presenter: pending + validated presentations use a slot. */
export function introSlotsLeft(rows: Pick<IntroRow, "introducer_id" | "status">[], me: string, max = INTRO_MAX): number {
  const used = rows.filter((r) => r.introducer_id === me && (r.status === "pending" || r.status === "validated")).length;
  return Math.max(0, max - used);
}

/** What is still missing for a presentation to validate (empty = nothing missing). */
export function introMissing(r: Pick<IntroRow, "a_confirmed" | "b_confirmed" | "pair_connected">): ("a" | "b" | "conexion")[] {
  const out: ("a" | "b" | "conexion")[] = [];
  if (!r.a_confirmed) out.push("a");
  if (!r.b_confirmed) out.push("b");
  if (!r.pair_connected) out.push("conexion");
  return out;
}

function cleanDbError(e: any): string {
  const msg: string = e?.message ?? "Error";
  if (msg.includes("reto_create_introduction") || msg.includes("reto_my_introductions")) return "«¡Te presento!» aún no está preparado en la base de datos.";
  return msg;
}

export async function fetchMyIntroductions(eventId: string): Promise<IntroRow[]> {
  const { data, error } = await retoDb.rpc("reto_my_introductions", { _event: eventId });
  if (error) throw new Error(cleanDbError(error));
  return data ?? [];
}

export async function createIntroduction(eventId: string, p1: string, p2: string): Promise<string> {
  const { data, error } = await retoDb.rpc("reto_create_introduction", { _event: eventId, _p1: p1, _p2: p2 });
  if (error) throw new Error(cleanDbError(error));
  return data as string;
}

export async function respondIntroduction(id: string, action: "confirm" | "withdraw" | "decline"): Promise<string> {
  const { data, error } = await retoDb.rpc("reto_respond_introduction", { _id: id, _action: action });
  if (error) throw new Error(cleanDbError(error));
  return data as string;
}

export async function cancelIntroduction(id: string): Promise<void> {
  const { error } = await retoDb.rpc("reto_cancel_introduction", { _id: id });
  if (error) throw new Error(cleanDbError(error));
}

// ---------------------------------------------------------------------
// Fase 6 · Misiones programadas, pausa y pop-ups (la hora la decide la BD)
// ---------------------------------------------------------------------

export type EntryPopup =
  | { kind: "mission"; mission_id: string; code: string; title: string; description: string | null; bonus_points: number; max_awards: number; unlocked_at: string }
  | { kind: "milestone"; value: number; total: number };

export async function fetchEntryPopup(eventId: string): Promise<EntryPopup | null> {
  const { data, error } = await retoDb.rpc("reto_entry_popup", { _event: eventId });
  if (error) return null; // nunca bloquear la app por un pop-up
  return (data as EntryPopup) ?? null;
}

export async function dismissEntryPopup(eventId: string, kind: EntryPopup["kind"]): Promise<void> {
  await retoDb.rpc("reto_dismiss_popup", { _event: eventId, _kind: kind });
}

export type AdminMissionAction = "activate_now" | "pause" | "resume" | "disable";

export async function adminMissionAction(id: string, action: AdminMissionAction): Promise<void> {
  const { error } = await retoDb.rpc("reto_admin_mission_action", { _id: id, _action: action });
  if (error) throw new Error(error.message?.includes("reto_admin_mission_action") ? "Falta ejecutar el SQL de la fase 6." : error.message);
}

export type AdminMissionState = "desactivada" | "pausada" | "sin_hora" | "programada" | "activa";

/** Estado que ve el superadmin (solo para mostrar; la BD decide con su propia hora). */
export function adminMissionState(
  m: { enabled: boolean; status: string; type: string; starts_at: string | null },
  nowMs: number,
): AdminMissionState {
  if (!m.enabled) return "desactivada";
  if (m.status === "paused") return "pausada";
  if (m.type === "sprint" && !m.starts_at) return "sin_hora";
  if (m.starts_at && new Date(m.starts_at).getTime() > nowMs) return "programada";
  return "activa";
}

/** Momentos del programa y qué misiones se desbloquean en cada uno. */
export const RETO_PROGRAM: { key: string; label: string; codes: string[] }[] = [
  { key: "bienvenida", label: "Bienvenida", codes: ["rompe_hielo", "fuera_burbuja"] },
  { key: "coctel", label: "Cóctel", codes: ["te_presento"] },
  { key: "cena", label: "Cena", codes: ["conexion_cruzada", "gran_puente"] },
  { key: "dia2", label: "Segundo día", codes: ["club_27", "leyenda_27h"] },
  { key: "final", label: "Tramo final", codes: ["sprint_final"] },
];

/** Qué hora (ISO) debe recibir cada misión según el programa. Momentos vacíos no cambian nada. */
export function programAssignments(times: Record<string, string | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of RETO_PROGRAM) {
    const t = times[p.key];
    if (t) for (const c of p.codes) out[c] = t;
  }
  return out;
}

export function formatMadrid(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

// ---------- Fase 7 · Rompe el hielo (27 comodines, sin puntos ni registro) ----------
export const ICEBREAKER_COUNT = 27;
export const RETO_DEFAULT_ICEBREAKERS: string[] = [
  "¿Cuál fue tu primer trabajo y qué aprendiste?",
  "¿Qué talento oculto tienes que no aparece en LinkedIn?",
  "¿A qué te dedicarías si no trabajaras en lo tuyo?",
  "¿Cuál ha sido tu momento más surrealista en una reunión?",
  "¿Qué moda corporativa eliminarías mañana?",
  "¿Qué pequeño hábito te ha cambiado la vida laboral?",
  "¿Qué decisión profesional parecía una locura y salió bien?",
  "¿A quién de este evento debería conocer y por qué?",
  "¿Qué idea te llevas ya de estas 27 horas?",
  "¿Qué trabajo nunca aceptarías?",
  "¿Qué persona te ha enseñado más en tu carrera?",
  "¿Qué pregunta te gustaría que te hicieran más a menudo?",
  "¿Qué afición sorprende más cuando la cuentas?",
  "¿Cuál ha sido tu mejor error profesional?",
  "¿Qué has cambiado de opinión en los últimos años?",
  "¿Qué harías con una semana sin reuniones?",
  "¿Qué consejo darías a tu yo de 25 años?",
  "¿Qué película describe mejor tu semana laboral?",
  "¿Qué pequeño logro profesional te hizo especial ilusión?",
  "¿Qué reto de RR. HH. crees que se exagera?",
  "¿Qué proyecto te gustaría poner en marcha mañana?",
  "¿Qué costumbre de tu empresa te enorgullece?",
  "¿Qué aprendiste de alguien muy distinto a ti?",
  "¿Cuál ha sido la conversación laboral más inesperada?",
  "Si pudieras intercambiar trabajo por un día, ¿con quién sería?",
  "¿Qué recomendarías visitar en tu ciudad?",
  "¿A qué dos personas de este evento presentarías entre sí?",
];

/** Random index in [0, count) that is never the same as `last` (when count > 1). */
export function pickIcebreaker(count: number, last: number | null, rand: () => number = Math.random): number {
  if (count <= 0) return -1;
  if (count === 1 || last === null || last < 0 || last >= count) return Math.min(count - 1, Math.floor(rand() * count));
  const i = Math.min(count - 2, Math.floor(rand() * (count - 1)));
  return i >= last ? i + 1 : i;
}

export type IcebreakerRow = { position: number; question: string };

/** Event's 27 questions; falls back to the default catalogue for any missing slot. */
export function mergeIcebreakers(rows: IcebreakerRow[]): string[] {
  const out = [...RETO_DEFAULT_ICEBREAKERS];
  for (const r of rows) {
    const q = r.question?.trim();
    if (r.position >= 1 && r.position <= ICEBREAKER_COUNT && q) out[r.position - 1] = q;
  }
  return out;
}

export async function fetchIcebreakers(eventId: string): Promise<string[]> {
  const { data, error } = await retoDb.from("reto_icebreakers").select("position, question").eq("event_id", eventId).order("position");
  if (error) return [...RETO_DEFAULT_ICEBREAKERS];
  return mergeIcebreakers((data ?? []) as IcebreakerRow[]);
}
