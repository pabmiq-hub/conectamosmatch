import { retoDb, type ScoreRow } from "@/lib/reto";

// ---------------------------------------------------------------------
// Fase 8 · Administración, participantes y cierre.
// Todo lo que cambia datos lo decide la base de datos; aquí solo hay ayudas de lectura y comprobaciones previas.
// ---------------------------------------------------------------------

export type RetoConfig = {
  event_id: string;
  is_active: boolean;
  emergency_off: boolean;
  is_closed: boolean;
  target: number;
  closes_at: string | null;
  closed_at?: string | null;
  superconector_user_id?: string | null;
  alma_user_id?: string | null;
  awards_note?: string | null;
  awards_at?: string | null;
};

export type RetoPhase = "emergencia" | "cerrado" | "desactivado" | "cierre_pendiente" | "abierto";

/** Estado del juego para mostrar. Mismo criterio que la función reto_is_open de la base de datos. */
export function retoPhase(
  cfg: Pick<RetoConfig, "is_active" | "emergency_off" | "is_closed" | "closes_at"> | null,
  nowMs: number,
): RetoPhase {
  if (!cfg) return "desactivado";
  if (cfg.emergency_off) return "emergencia";
  if (cfg.is_closed) return "cerrado";
  if (!cfg.is_active) return "desactivado";
  if (cfg.closes_at && new Date(cfg.closes_at).getTime() <= nowMs) return "cierre_pendiente";
  return "abierto";
}

export function isRetoOpen(cfg: Parameters<typeof retoPhase>[0], nowMs: number): boolean {
  return retoPhase(cfg, nowMs) === "abierto";
}

/**
 * Candidatos a premio. Superconector = máximo de conexiones (>0).
 * Alma Conectamos = máximo de puntos (>0) sin contar al Superconector elegido
 * (si aún no hay elegido y solo hay un líder en conexiones, se excluye a ese líder).
 * Si hay más de un candidato es un empate y el organizador debe registrar el desempate.
 */
export function winnerCandidates(rows: ScoreRow[], superId?: string | null) {
  const maxC = Math.max(0, ...rows.map((r) => r.connections));
  const superTop = maxC > 0 ? rows.filter((r) => r.connections === maxC) : [];
  const excluded = superId ?? (superTop.length === 1 ? superTop[0].user_id : null);
  const rest = excluded ? rows.filter((r) => r.user_id !== excluded) : rows;
  const maxP = Math.max(0, ...rest.map((r) => r.points));
  const almaTop = maxP > 0 && (excluded || superTop.length === 0) ? rest.filter((r) => r.points === maxP) : [];
  return { superTop, almaTop, superTie: superTop.length > 1, almaTie: almaTop.length > 1 };
}

/** Comprobación previa de ganadores (la base de datos la repite). Devuelve el error o null. */
export function validateWinners(rows: ScoreRow[], superId: string | null, almaId: string | null): string | null {
  if (!superId && !almaId) return null;
  if (!superId) return "Elige antes al Superconector";
  const { superTop } = winnerCandidates(rows);
  if (!superTop.some((r) => r.user_id === superId)) return "El Superconector debe ser quien más conexiones tiene";
  if (!almaId) return null;
  if (almaId === superId) return "Alma Conectamos debe ser una persona distinta al Superconector";
  const { almaTop } = winnerCandidates(rows, superId);
  if (!almaTop.some((r) => r.user_id === almaId)) return "Alma Conectamos debe ser quien más puntos tiene (sin contar al Superconector)";
  return null;
}

export type Mark = { from: string; to: string; created_at?: string | null };
export type Pair = { a: string; b: string; validated_at: string | null };

/** Parejas recíprocas únicas (a < b). Fecha de validación = la segunda marca. */
export function reciprocalPairs(marks: Mark[], allowed?: Set<string>): Pair[] {
  const byKey = new Map<string, Mark>();
  for (const m of marks) byKey.set(`${m.from}>${m.to}`, m);
  const out: Pair[] = [];
  for (const m of marks) {
    if (m.from >= m.to) continue;
    if (allowed && (!allowed.has(m.from) || !allowed.has(m.to))) continue;
    const back = byKey.get(`${m.to}>${m.from}`);
    if (!back) continue;
    const dates = [m.created_at, back.created_at].filter(Boolean) as string[];
    out.push({ a: m.from, b: m.to, validated_at: dates.length ? dates.sort().at(-1)! : null });
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Emails de un Excel/CSV: columna «email»/«correo» si existe; si no, cualquier celda con forma de email. */
export function parseEmailList(rows: Record<string, unknown>[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const keys = Object.keys(row);
    const col = keys.find((k) => /e-?mail|correo/i.test(k));
    const values = col ? [row[col]] : keys.map((k) => row[k]);
    for (const v of values) {
      const s = String(v ?? "").trim().toLowerCase();
      if (EMAIL_RE.test(s)) set.add(s);
    }
  }
  return [...set];
}

export function matchEmails(emails: string[], profiles: { id: string; email: string | null }[]) {
  const byEmail = new Map(profiles.filter((p) => p.email).map((p) => [p.email!.trim().toLowerCase(), p.id]));
  const found: string[] = [];
  const missing: string[] = [];
  for (const e of emails) {
    const id = byEmail.get(e.trim().toLowerCase());
    if (id) found.push(id); else missing.push(e);
  }
  return { found: [...new Set(found)], missing };
}

// ---------- Lecturas y acciones (la base de datos valida permisos y reglas) ----------

function dbError(e: any): Error {
  const msg: string = e?.message ?? "Error";
  if (/reto_admin_|reto_finalize_if_due|reto_snapshots|closed_at|function .* does not exist/i.test(msg) && /does not exist|schema cache|Could not find/i.test(msg)) {
    return new Error("Falta ejecutar el SQL de la fase 8 en Supabase.");
  }
  return new Error(msg);
}

export async function fetchRetoConfig(eventId: string): Promise<RetoConfig | null> {
  const { data } = await retoDb.from("reto_config").select("*").eq("event_id", eventId).maybeSingle();
  return (data as RetoConfig) ?? null;
}

/** Si ya pasó la hora de cierre, congela los resultados. Nunca bloquea la pantalla. */
export async function finalizeIfDue(eventId: string): Promise<void> {
  await retoDb.rpc("reto_finalize_if_due", { _event: eventId }).then(() => null, () => null);
}

export async function adminClose(eventId: string): Promise<boolean> {
  const { data, error } = await retoDb.rpc("reto_admin_close", { _event: eventId });
  if (error) throw dbError(error);
  return !!data;
}

export async function adminReopen(eventId: string): Promise<void> {
  const { error } = await retoDb.rpc("reto_admin_reopen", { _event: eventId });
  if (error) throw dbError(error);
}

export async function adminSetWinners(eventId: string, superId: string | null, almaId: string | null, note: string): Promise<void> {
  const { error } = await retoDb.rpc("reto_admin_set_winners", { _event: eventId, _super: superId, _alma: almaId, _note: note });
  if (error) throw dbError(error);
}

export type RetoSummary = {
  participants: number; drh: number; sponsors: number; validated: number; pending: number; marks: number;
  awards: number; bonus_total: number; revokes: number; intros_validated: number; intros_pending: number;
  last_mark_at: string | null; snapshot_at: string | null; snapshot_rows: number;
};

export async function adminSummary(eventId: string): Promise<RetoSummary> {
  const { data, error } = await retoDb.rpc("reto_admin_summary", { _event: eventId });
  if (error) throw dbError(error);
  return data as RetoSummary;
}

export async function adminAddParticipants(eventId: string, userIds: string[]): Promise<number> {
  const { data, error } = await retoDb.rpc("reto_admin_add_participants", { _event: eventId, _users: userIds });
  if (error) throw dbError(error);
  return Number(data) || 0;
}

export async function adminRemoveParticipants(eventId: string, userIds: string[]): Promise<number> {
  const { data, error } = await retoDb.rpc("reto_admin_remove_participants", { _event: eventId, _users: userIds });
  if (error) throw dbError(error);
  return Number(data) || 0;
}

export async function adminEnableEvent(eventId: string): Promise<void> {
  const { error } = await retoDb.rpc("reto_admin_enable_event", { _event: eventId });
  if (error) throw dbError(error);
}

/** Lee todas las filas de una consulta en bloques de 1000 (límite de Supabase). */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw dbError(error);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// ---------- Horas en zona Madrid para los campos de fecha ----------
export function toMadridLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function fromMadridLocal(v: string): string | null {
  if (!v) return null;
  const guess = new Date(`${v}:00Z`);
  const local = toMadridLocal(guess.toISOString());
  const diff = new Date(`${local}:00Z`).getTime() - guess.getTime();
  return new Date(guess.getTime() - diff).toISOString();
}
