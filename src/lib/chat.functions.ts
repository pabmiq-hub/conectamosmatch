import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ChatPerson {
  userId: string;
  name: string;
  cargo: string | null;
  avatar: string | null;
  company: string;
  logo: string | null;
  kind: "empresa" | "sponsor";
  badge: string | null; // "Match" / "Reunión 1:1" with that account
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
}

// Open chat: every active empresa/solución responsable can message any other, person to person.
export const listChatDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: me } = await db.from("profiles").select("account_id, role").eq("id", userId).maybeSingle();

    const [{ data: ps }, { data: emps }, { data: sps }, { data: msgs }, { data: reads }] = await Promise.all([
      db.from("profiles").select("id, full_name, cargo, avatar_url, account_id, role, is_active").in("role", ["empresa", "sponsor"]).limit(2000),
      db.from("empresa_profiles").select("id, company_name, logo_url"),
      db.from("sponsor_profiles").select("id, company_name, logo_url"),
      db.from("chat_dm").select("user_a, user_b, sender_id, body, created_at").or(`user_a.eq.${userId},user_b.eq.${userId}`).order("created_at", { ascending: false }).limit(1000),
      db.from("chat_dm_reads").select("partner_id, last_read_at").eq("user_id", userId),
    ]);

    const badges = new Map<string, Set<string>>();
    if (me?.account_id && (me.role === "empresa" || me.role === "sponsor")) {
      const isEmp = me.role === "empresa";
      const mine = isEmp ? "empresa_account_id" : "sponsor_account_id";
      const other = isEmp ? "sponsor_account_id" : "empresa_account_id";
      const [{ data: ms }, { data: mt }] = await Promise.all([
        db.from("matches").select(other).eq(mine, me.account_id).eq("status", "mutual"),
        db.from("meetings_1to1").select(`${other}, status`).eq(mine, me.account_id),
      ]);
      const add = (k: string, v: string) => k && (badges.get(k) ?? badges.set(k, new Set()).get(k)!).add(v);
      (ms ?? []).forEach((r: any) => add(r[other], "Match"));
      (mt ?? []).forEach((r: any) => r.status !== "cancelled" && add(r[other], "Reunión 1:1"));
    }

    const accs = new Map<string, any>();
    (emps ?? []).forEach((a: any) => accs.set(a.id, a));
    (sps ?? []).forEach((a: any) => accs.set(a.id, a));
    const readMap = new Map((reads ?? []).map((r: any) => [r.partner_id, r.last_read_at]));

    const people: ChatPerson[] = (ps ?? [])
      .filter((p: any) => p.id !== userId && p.is_active !== false)
      .map((p: any) => {
        const acc = accs.get(p.account_id);
        const pm = (msgs ?? []).filter((m: any) => m.user_a === p.id || m.user_b === p.id);
        const lr = readMap.get(p.id);
        const b = badges.get(p.account_id);
        return {
          userId: p.id,
          name: p.full_name || acc?.company_name || "Participante",
          cargo: p.cargo ?? null,
          avatar: p.avatar_url ?? null,
          company: acc?.company_name ?? "",
          logo: acc?.logo_url ?? null,
          kind: p.role,
          badge: b ? [...b].join(" · ") : null,
          lastMessage: pm[0]?.body ?? null,
          lastAt: pm[0]?.created_at ?? null,
          unread: pm.filter((m: any) => m.sender_id !== userId && (!lr || m.created_at > lr)).length,
        };
      });
    people.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "") || a.company.localeCompare(b.company, "es") || a.name.localeCompare(b.name, "es"));
    return { people };
  });
