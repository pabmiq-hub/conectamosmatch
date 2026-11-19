// Server-only helpers that define "who belongs to an event".
// An account (empresa / solución) is part of an event when at least one of its
// members has a non-cancelled row in event_registrations for that event.
// Every panel uses this so each event only shows its own participants.

type Db = any;

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export type EventScope = {
  accountIds: Set<string>;
  empresaAccountIds: Set<string>;
  sponsorAccountIds: Set<string>;
  /** Every member (profile id) of a participating account. */
  userIds: Set<string>;
};

export async function getEventScope(db: Db, eventId: string): Promise<EventScope> {
  const regs = await fetchAll<{ user_id: string | null }>((a, b) =>
    db.from("event_registrations").select("user_id").eq("event_id", eventId).neq("status", "cancelled").range(a, b),
  );
  const regUserIds = Array.from(new Set(regs.map((r) => r.user_id).filter(Boolean))) as string[];
  const accountIds = new Set<string>();
  const userIds = new Set<string>(regUserIds);
  for (let i = 0; i < regUserIds.length; i += 300) {
    const { data } = await db.from("profiles").select("id, account_id").in("id", regUserIds.slice(i, i + 300));
    (data ?? []).forEach((p: any) => p.account_id && accountIds.add(p.account_id));
  }
  const accList = Array.from(accountIds);
  const empresaAccountIds = new Set<string>();
  const sponsorAccountIds = new Set<string>();
  for (let i = 0; i < accList.length; i += 300) {
    const chunk = accList.slice(i, i + 300);
    const [{ data: members }, { data: emps }, { data: sps }] = await Promise.all([
      db.from("profiles").select("id").in("account_id", chunk),
      db.from("empresa_profiles").select("id").in("id", chunk),
      db.from("sponsor_profiles").select("id").in("id", chunk),
    ]);
    (members ?? []).forEach((m: any) => userIds.add(m.id));
    (emps ?? []).forEach((e: any) => empresaAccountIds.add(e.id));
    (sps ?? []).forEach((s: any) => sponsorAccountIds.add(s.id));
  }
  return { accountIds, empresaAccountIds, sponsorAccountIds, userIds };
}

const STATUS_RANK: Record<string, number> = { ongoing: 0, published: 1, draft: 3, finished: 4 };

/** Picks the event a participant is currently working in, among the events their account is registered for. */
export function pickCurrentEvent<T extends { status: string | null; event_date: string | null; end_date?: string | null }>(events: T[], now = Date.now()): T | null {
  const usable = events.filter((e) => e.status !== "cancelled");
  if (!usable.length) return null;
  const score = (e: T) => {
    const end = new Date(e.end_date ?? e.event_date ?? 0).getTime();
    let rank = STATUS_RANK[e.status ?? "draft"] ?? 3;
    // A published event whose dates are long past behaves like a finished one.
    if (rank === 1 && end && end < now - 2 * 86400000) rank = 2;
    return rank;
  };
  return [...usable].sort((a, b) => {
    const d = score(a) - score(b);
    if (d) return d;
    const ta = new Date(a.event_date ?? 0).getTime();
    const tb = new Date(b.event_date ?? 0).getTime();
    // Upcoming/current: earliest first. Past (finished): most recent first.
    return score(a) >= 2 ? tb - ta : ta - tb;
  })[0];
}
