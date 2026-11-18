/**
 * Motor de propuestas de reuniones 1to1 (puro, sin BD). Todas las horas en hora local de Madrid.
 * Reglas duras: nadie en dos reuniones a la vez, mesa libre, franja disponible para ambos,
 * tope por cuenta (empresa / modalidad de solución) y máximo diario de cada persona.
 */
export type Window = { date: string; start: string; end: string; label?: string };
export type Slot = { date: string; start: string; end: string; label?: string };
export type MatchInput = {
  match_id: string | null;
  empresa_user_id: string;
  sponsor_user_id: string;
  empresa_account_id: string;
  sponsor_account_id: string;
};
export type Availability = { attends: boolean; blocked: { from: string; to: string }[]; max: number | null };
export type Busy = { user_id: string; date: string; start: string; end: string; room?: string | null };
export type Proposal = MatchInput & { date: string; start: string; end: string; room: string; label?: string };
export type Unassigned = MatchInput & { reason: string };

export type GeneratorInput = {
  windows: Window[];
  slotMinutes: number;
  rooms: string[];
  matches: MatchInput[];
  /** key `${user_id}|${date}` */
  availability: Record<string, Availability>;
  /** Tope de reuniones por cuenta (ya incluye las existentes descontadas fuera o no). */
  accountCap: Record<string, number>;
  /** Reuniones ya existentes en el evento (cuentan para conflictos y topes). */
  existing: (Busy & { empresa_account_id?: string | null; sponsor_account_id?: string | null })[];
};

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const overlap = (a1: number, a2: number, b1: number, b2: number) => a1 < b2 && b1 < a2;

export function buildSlots(windows: Window[], slotMinutes: number): Slot[] {
  const out: Slot[] = [];
  for (const w of windows) {
    for (let t = toMin(w.start); t + slotMinutes <= toMin(w.end); t += slotMinutes) {
      out.push({ date: w.date, start: toHHMM(t), end: toHHMM(t + slotMinutes), label: w.label });
    }
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

export function generateProposal(input: GeneratorInput): { proposals: Proposal[]; unassigned: Unassigned[] } {
  const slots = buildSlots(input.windows, input.slotMinutes);
  const busy: Busy[] = [...input.existing];
  const accountCount: Record<string, number> = {};
  for (const e of input.existing) {
    if (e.empresa_account_id) accountCount[e.empresa_account_id] = (accountCount[e.empresa_account_id] ?? 0) + 0.5;
    if (e.sponsor_account_id) accountCount[e.sponsor_account_id] = (accountCount[e.sponsor_account_id] ?? 0) + 0.5;
  }
  // existing rows appear twice in busy (one per person) → each counted 0.5 per account side
  const dayCount: Record<string, number> = {};
  for (const e of input.existing) dayCount[`${e.user_id}|${e.date}`] = (dayCount[`${e.user_id}|${e.date}`] ?? 0) + 1;

  const avOk = (user: string, s: Slot) => {
    const a = input.availability[`${user}|${s.date}`];
    if (!a) return true;
    if (!a.attends) return false;
    return !a.blocked.some((b) => overlap(toMin(s.start), toMin(s.end), toMin(b.from), toMin(b.to)));
  };
  const userFree = (user: string, s: Slot) =>
    !busy.some((b) => b.user_id === user && b.date === s.date && overlap(toMin(s.start), toMin(s.end), toMin(b.start), toMin(b.end)));
  const dayOk = (user: string, s: Slot) => {
    const a = input.availability[`${user}|${s.date}`];
    return a?.max == null || (dayCount[`${user}|${s.date}`] ?? 0) < a.max;
  };
  const freeRoom = (s: Slot) =>
    input.rooms.find((r) => !busy.some((b) => b.room === r && b.date === s.date && overlap(toMin(s.start), toMin(s.end), toMin(b.start), toMin(b.end))));
  const capOk = (acc: string) => (accountCount[acc] ?? 0) < (input.accountCap[acc] ?? Infinity);

  const feasible = (m: MatchInput) => slots.filter((s) => avOk(m.empresa_user_id, s) && avOk(m.sponsor_user_id, s));
  const ordered = input.matches.map((m) => ({ m, opts: feasible(m) })).sort((a, b) => a.opts.length - b.opts.length);

  const proposals: Proposal[] = [];
  const unassigned: Unassigned[] = [];
  for (const { m, opts } of ordered) {
    if (!capOk(m.empresa_account_id)) { unassigned.push({ ...m, reason: "La empresa ya alcanzó su tope de reuniones" }); continue; }
    if (!capOk(m.sponsor_account_id)) { unassigned.push({ ...m, reason: "La solución ya alcanzó su tope de reuniones" }); continue; }
    if (opts.length === 0) { unassigned.push({ ...m, reason: slots.length ? "No coinciden en ninguna franja disponible" : "El evento no tiene franjas de reuniones" }); continue; }
    let placed = false;
    for (const s of opts) {
      if (!userFree(m.empresa_user_id, s) || !userFree(m.sponsor_user_id, s)) continue;
      if (!dayOk(m.empresa_user_id, s) || !dayOk(m.sponsor_user_id, s)) continue;
      const room = freeRoom(s);
      if (!room) continue;
      proposals.push({ ...m, date: s.date, start: s.start, end: s.end, room, label: s.label });
      busy.push({ user_id: m.empresa_user_id, date: s.date, start: s.start, end: s.end, room });
      busy.push({ user_id: m.sponsor_user_id, date: s.date, start: s.start, end: s.end });
      accountCount[m.empresa_account_id] = (accountCount[m.empresa_account_id] ?? 0) + 1;
      accountCount[m.sponsor_account_id] = (accountCount[m.sponsor_account_id] ?? 0) + 1;
      for (const u of [m.empresa_user_id, m.sponsor_user_id]) dayCount[`${u}|${s.date}`] = (dayCount[`${u}|${s.date}`] ?? 0) + 1;
      placed = true;
      break;
    }
    if (!placed) unassigned.push({ ...m, reason: "Sin hueco libre común (agendas o mesas completas)" });
  }
  proposals.sort((a, b) => (a.date + a.start + a.room).localeCompare(b.date + b.start + b.room));
  return { proposals, unassigned };
}
