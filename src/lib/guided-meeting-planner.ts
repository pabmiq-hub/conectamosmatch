/**
 * Planificador guiado de reuniones 1to1 (puro, sin BD), según la Guía técnica de matching.
 * Fases: fijas → listas cerradas (DRH con 1–6 selecciones) → garantías por holgura mínima
 * (Platinum→Gold→Premium→Basic→Startup) → mínimos por DRH → extras promocionales.
 * Reglas duras: disponibilidad, sin solapes, representantes y mesas por slot, vetos,
 * sin repetir pareja, grupos que no repiten sponsor, mínimo de DRH libres en slots de Talk.
 * Solo se proponen sponsors que el DRH seleccionó (nunca se inventa interés).
 */
export type PSlot = { id: string; date: string; start: string; end: string; talk: boolean };
export type Unit = {
  id: string;
  members: string[]; // user ids (2 = sesión conjunta, p. ej. dos DRH de la misma empresa)
  accountId: string;
  name: string;
  slots: string[]; // slots disponibles
  selections: string[]; // sponsor account ids seleccionados por la cuenta
  mutual: string[]; // subconjunto recíproco
  vetoes?: string[];
  maxMeetings: number;
  minMeetings?: number;
  exactSlots?: boolean; // debe ocupar todos sus slots (Andrea/Sonia, Bárbara+África)
  disjointGroup?: string; // unidades del mismo grupo no repiten sponsor
};
export type Rep = { userId: string; slots: string[] };
export type Sponsor = {
  accountId: string;
  name: string;
  tier: "PLATINUM" | "GOLD" | "PREMIUM" | "BASIC" | "STARTUP";
  guarantee: number; // participaciones DRH
  promoTarget?: number;
  tableCap: number;
  reps: Rep[];
  /** slots donde una sesión admite 2 DRH (Leeters viernes) */
  groupSlots?: string[];
};
export type Fixed = { unitId: string; sponsorId: string; slotId: string };
export type PlanInput = {
  slots: PSlot[];
  units: Unit[];
  sponsors: Sponsor[];
  fixed?: Fixed[];
  minFreeOnTalk: number;
  closedListMax?: number; // 6
};
export type Kind = "FIJA" | "SELECCION_DRH" | "GARANTIA" | "EXTRA_PROTECCION_DRH" | "MINIMO_DRH" | "EXTRA_PROMOCIONAL";
export type Session = { id: string; slotId: string; sponsorId: string; repUserId: string; table: number; units: string[] };
export type Assignment = { unitId: string; sponsorId: string; slotId: string; sessionId: string; mutual: boolean; kind: Kind };
export type Issue = { unitId?: string; sponsorId?: string; reason: string };

const TIER_ORDER = { PLATINUM: 0, GOLD: 1, PREMIUM: 2, BASIC: 3, STARTUP: 4 } as const;

export function planMeetings(input: PlanInput) {
  const closedMax = input.closedListMax ?? 6;
  const unitById = new Map(input.units.map((u) => [u.id, u]));
  const spById = new Map(input.sponsors.map((s) => [s.accountId, s]));
  const slotIdx = new Map(input.slots.map((s, i) => [s.id, i]));
  const sessions: Session[] = [];
  const assignments: Assignment[] = [];
  const issues: Issue[] = [];
  const unitBusy = new Map<string, Set<string>>();
  const unitCount = new Map<string, number>();
  const pairDone = new Set<string>();
  const groupSponsors = new Map<string, Set<string>>();
  const participations = new Map<string, number>();
  const presentBySlot = new Map<string, number>();
  const occupiedBySlot = new Map<string, number>();
  for (const u of input.units) for (const s of u.slots) presentBySlot.set(s, (presentBySlot.get(s) ?? 0) + u.members.length);

  const isClosed = (u: Unit) => u.selections.length >= 1 && u.selections.length <= closedMax;
  const groupKey = (u: Unit) => u.disjointGroup ?? `u:${u.id}`;

  function canUnit(u: Unit, sp: Sponsor, slotId: string) {
    if (!u.slots.includes(slotId)) return "no disponible";
    if (unitBusy.get(u.id)?.has(slotId)) return "ocupado";
    if ((unitCount.get(u.id) ?? 0) >= u.maxMeetings) return "tope DRH";
    if (u.vetoes?.includes(sp.accountId)) return "veto";
    if (pairDone.has(`${u.id}|${sp.accountId}`)) return "repetida";
    if (groupSponsors.get(groupKey(u))?.has(sp.accountId)) return "repite sponsor en grupo";
    const slot = input.slots[slotIdx.get(slotId)!]!;
    if (slot.talk && (occupiedBySlot.get(slotId) ?? 0) + u.members.length > (presentBySlot.get(slotId) ?? 0) - input.minFreeOnTalk) return "mínimo libres Talk";
    return null;
  }
  /** Devuelve sesión existente a la que unirse o datos para una nueva. */
  function seat(u: Unit, sp: Sponsor, slotId: string): { join?: Session; rep?: string; table?: number } | null {
    if (u.members.length === 1 && sp.groupSlots?.includes(slotId)) {
      const open = sessions.find((s) => s.slotId === slotId && s.sponsorId === sp.accountId && s.units.length === 1 && unitById.get(s.units[0]!)!.members.length === 1);
      if (open) return { join: open };
    }
    const here = sessions.filter((s) => s.slotId === slotId && s.sponsorId === sp.accountId);
    if (here.length >= sp.tableCap) return null;
    const rep = sp.reps.find((r) => r.slots.includes(slotId) && !here.some((s) => s.repUserId === r.userId));
    if (!rep) return null;
    return { rep: rep.userId, table: here.length + 1 };
  }
  function place(u: Unit, sp: Sponsor, slotId: string, kind: Kind) {
    const st = seat(u, sp, slotId);
    if (!st) return false;
    let sess = st.join;
    if (!sess) {
      sess = { id: `S${sessions.length + 1}`, slotId, sponsorId: sp.accountId, repUserId: st.rep!, table: st.table!, units: [] };
      sessions.push(sess);
    }
    sess.units.push(u.id);
    assignments.push({ unitId: u.id, sponsorId: sp.accountId, slotId, sessionId: sess.id, mutual: u.mutual.includes(sp.accountId), kind });
    if (!unitBusy.has(u.id)) unitBusy.set(u.id, new Set());
    unitBusy.get(u.id)!.add(slotId);
    unitCount.set(u.id, (unitCount.get(u.id) ?? 0) + 1);
    pairDone.add(`${u.id}|${sp.accountId}`);
    if (!groupSponsors.has(groupKey(u))) groupSponsors.set(groupKey(u), new Set());
    groupSponsors.get(groupKey(u))!.add(sp.accountId);
    participations.set(sp.accountId, (participations.get(sp.accountId) ?? 0) + u.members.length);
    occupiedBySlot.set(slotId, (occupiedBySlot.get(slotId) ?? 0) + u.members.length);
    return true;
  }
  /** Mejor slot: unirse a sesión grupal abierta, luego slot con menos ocupación (respeta Talks). */
  function tryPlace(u: Unit, sp: Sponsor, kind: Kind) {
    const cands = input.slots.filter((s) => !canUnit(u, sp, s.id) && seat(u, sp, s.id));
    if (!cands.length) return false;
    cands.sort((a, b) => {
      const ja = seat(u, sp, a.id)?.join ? 0 : 1, jb = seat(u, sp, b.id)?.join ? 0 : 1;
      if (ja !== jb) return ja - jb;
      const ra = (occupiedBySlot.get(a.id) ?? 0) / Math.max(1, presentBySlot.get(a.id) ?? 1);
      const rb = (occupiedBySlot.get(b.id) ?? 0) / Math.max(1, presentBySlot.get(b.id) ?? 1);
      return ra - rb || slotIdx.get(a.id)! - slotIdx.get(b.id)!;
    });
    return place(u, sp, cands[0]!.id, kind);
  }
  const feasibleCount = (u: Unit, sp: Sponsor) => input.slots.filter((s) => !canUnit(u, sp, s.id) && seat(u, sp, s.id)).length;
  const left = (sp: Sponsor) => sp.guarantee - (participations.get(sp.accountId) ?? 0);

  // A. Fijas
  for (const f of input.fixed ?? []) {
    const u = unitById.get(f.unitId), sp = spById.get(f.sponsorId);
    if (!u || !sp) { issues.push({ unitId: f.unitId, sponsorId: f.sponsorId, reason: "Cita fija con datos inexistentes" }); continue; }
    const why = canUnit(u, sp, f.slotId);
    if (why || !place(u, sp, f.slotId, "FIJA")) issues.push({ unitId: u.id, sponsorId: sp.accountId, reason: `Cita fija imposible: ${why ?? "sin mesa/representante"}` });
  }

  // B. Listas cerradas: unidades con menos holgura primero; mutuos primero.
  const closed = input.units.filter(isClosed).sort((a, b) => (Number(!!b.exactSlots) - Number(!!a.exactSlots)) || a.slots.length - b.slots.length);
  for (const u of closed) {
    const sel = [...u.selections].filter((s) => spById.has(s)).sort((a, b) => Number(u.mutual.includes(b)) - Number(u.mutual.includes(a)) || feasibleCount(u, spById.get(a)!) - feasibleCount(u, spById.get(b)!));
    for (const sid of sel) {
      if (pairDone.has(`${u.id}|${sid}`)) continue;
      const sp = spById.get(sid)!;
      const kind: Kind = left(sp) > 0 ? "SELECCION_DRH" : "EXTRA_PROTECCION_DRH";
      if (!tryPlace(u, sp, kind)) issues.push({ unitId: u.id, sponsorId: sid, reason: "Selección del DRH sin hueco compatible (agenda, mesas o mínimo de libres en Talk)" });
    }
  }

  // C. Garantías: sponsor con menor holgura (candidatos viables − pendiente), luego categoría.
  const open = input.units.filter((u) => u.selections.length > closedMax);
  const candidatesFor = (sp: Sponsor) => open.filter((u) => u.selections.includes(sp.accountId) && feasibleCount(u, sp) > 0);
  for (let guard = 0; guard < 5000; guard++) {
    const pending = input.sponsors.filter((s) => left(s) > 0).map((s) => ({ s, c: candidatesFor(s) })).filter((x) => x.c.length);
    if (!pending.length) break;
    pending.sort((a, b) => (a.c.length - left(a.s)) - (b.c.length - left(b.s)) || TIER_ORDER[a.s.tier] - TIER_ORDER[b.s.tier]);
    const { s, c } = pending[0]!;
    // DRH: mutuo primero, con menos reuniones y menos alternativas
    c.sort((a, b) => Number(b.mutual.includes(s.accountId)) - Number(a.mutual.includes(s.accountId)) || (unitCount.get(a.id) ?? 0) - (unitCount.get(b.id) ?? 0) || feasibleCount(a, s) - feasibleCount(b, s));
    if (!tryPlace(c[0]!, s, "GARANTIA")) break;
  }

  // D. Mínimos por DRH abiertos (p. ej. ≥4) con sus selecciones restantes.
  for (const u of open) {
    while ((unitCount.get(u.id) ?? 0) < (u.minMeetings ?? 0)) {
      const opts = u.selections.map((id) => spById.get(id)).filter((s): s is Sponsor => !!s && feasibleCount(u, s) > 0)
        .sort((a, b) => Number(u.mutual.includes(b.accountId)) - Number(u.mutual.includes(a.accountId)) || (participations.get(a.accountId) ?? 0) - a.guarantee - ((participations.get(b.accountId) ?? 0) - b.guarantee));
      if (!opts.length || !tryPlace(u, opts[0]!, "MINIMO_DRH")) break;
    }
  }

  // E. Extras promocionales hasta promoTarget.
  for (const sp of input.sponsors.filter((s) => s.promoTarget)) {
    while ((participations.get(sp.accountId) ?? 0) < sp.promoTarget!) {
      const c = candidatesFor(sp).sort((a, b) => Number(b.mutual.includes(sp.accountId)) - Number(a.mutual.includes(sp.accountId)) || (unitCount.get(a.id) ?? 0) - (unitCount.get(b.id) ?? 0));
      if (!c.length || !tryPlace(c[0]!, sp, "EXTRA_PROMOCIONAL")) break;
    }
  }

  // Validaciones finales
  for (const u of input.units) {
    const n = unitCount.get(u.id) ?? 0;
    if (u.exactSlots && n < u.slots.length) issues.push({ unitId: u.id, reason: `Debe ocupar ${u.slots.length} slots y tiene ${n}` });
    if (u.minMeetings && n < u.minMeetings) issues.push({ unitId: u.id, reason: `Mínimo ${u.minMeetings} reuniones; tiene ${n}` });
    if (u.selections.length === 0 && u.slots.length) issues.push({ unitId: u.id, reason: "Sin selecciones: no se asigna nada automáticamente" });
  }
  const sponsorReport = input.sponsors.map((s) => {
    const mine = assignments.filter((a) => a.sponsorId === s.accountId);
    const parts = (k?: Kind) => mine.filter((a) => !k || a.kind === k).reduce((t, a) => t + unitById.get(a.unitId)!.members.length, 0);
    const mutualAll = input.units.filter((u) => u.mutual.includes(s.accountId)).length;
    const unilateral = input.units.filter((u) => u.selections.includes(s.accountId) && !u.mutual.includes(s.accountId)).length;
    const total = parts();
    const extras = parts("EXTRA_PROTECCION_DRH") + parts("EXTRA_PROMOCIONAL");
    return {
      sponsorId: s.accountId, name: s.name, tier: s.tier, guarantee: s.guarantee, mutualMatches: mutualAll, unilateralSelections: unilateral,
      sessions: new Set(mine.map((a) => a.sessionId)).size, participations: total,
      protectionExtras: parts("EXTRA_PROTECCION_DRH"), promoExtras: parts("EXTRA_PROMOCIONAL"),
      deficit: Math.max(0, s.guarantee - (total - extras)),
    };
  });
  const slotReport = input.slots.map((s) => ({ slotId: s.id, talk: s.talk, present: presentBySlot.get(s.id) ?? 0, occupied: occupiedBySlot.get(s.id) ?? 0, free: (presentBySlot.get(s.id) ?? 0) - (occupiedBySlot.get(s.id) ?? 0) }));
  return { sessions, assignments, issues, sponsorReport, slotReport, unitCount: Object.fromEntries(unitCount) };
}
