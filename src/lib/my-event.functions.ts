import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyEvent = {
  id: string;
  title: string;
  status: string | null;
  event_date: string | null;
  end_date: string | null;
  empresa_min_likes: number | null;
  [k: string]: any;
};

export type MyEventScope = {
  event: MyEvent | null;
  empresaAccountIds: string[];
  sponsorAccountIds: string[];
  userIds: string[];
  /** account id -> profile id acting as responsable (fallback when the account has no user_id). */
  accountOwners: Record<string, string>;
};

/** The event the signed-in participant belongs to, plus who else takes part in it. */
export const getMyEventScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyEventScope> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getEventScope, pickCurrentEvent } = await import("./event-scope.server");
    const db = supabaseAdmin as any;
    const empty: MyEventScope = { event: null, empresaAccountIds: [], sponsorAccountIds: [], userIds: [], accountOwners: {} };

    const { data: me } = await db.from("profiles").select("account_id").eq("id", userId).maybeSingle();
    let teamIds = [userId];
    if (me?.account_id) {
      const { data: team } = await db.from("profiles").select("id").eq("account_id", me.account_id);
      teamIds = Array.from(new Set([userId, ...(team ?? []).map((t: any) => t.id)]));
    }
    const { data: regs } = await db.from("event_registrations").select("event_id").in("user_id", teamIds).neq("status", "cancelled");
    const eventIds = Array.from(new Set((regs ?? []).map((r: any) => r.event_id).filter(Boolean)));
    if (!eventIds.length) return empty;
    const { data: events } = await db.from("events").select("*").in("id", eventIds).or("is_active.is.null,is_active.eq.true");
    const ev = pickCurrentEvent((events ?? []) as MyEvent[]);
    if (!ev) return empty;
    const scope = await getEventScope(db, ev.id);
    const { resolveAccountOwner } = await import("./account-owner");
    const accIds = Array.from(scope.accountIds);
    const accountOwners: Record<string, string> = {};
    for (let i = 0; i < accIds.length; i += 300) {
      const chunk = accIds.slice(i, i + 300);
      const [{ data: members }, { data: emps }, { data: sps }] = await Promise.all([
        db.from("profiles").select("id, account_id, account_role, is_active").in("account_id", chunk),
        db.from("empresa_profiles").select("id, user_id").in("id", chunk),
        db.from("sponsor_profiles").select("id, user_id").in("id", chunk),
      ]);
      [...(emps ?? []), ...(sps ?? [])].forEach((a: any) => {
        const o = resolveAccountOwner(a, members ?? []);
        if (o) accountOwners[a.id] = o;
      });
    }
    return {
      accountOwners,
      event: ev,
      empresaAccountIds: Array.from(scope.empresaAccountIds),
      sponsorAccountIds: Array.from(scope.sponsorAccountIds),
      userIds: Array.from(scope.userIds),
    };
  });
