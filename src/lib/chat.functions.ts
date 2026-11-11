import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ChatConversation {
  partnerAccountId: string;
  partnerName: string;
  partnerLogo: string | null;
  empresaAccountId: string;
  sponsorAccountId: string;
  origin: "match" | "reunion" | "ambos";
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
}

// Lists the accounts the current user may chat with: mutual match or non-cancelled 1:1 meeting.
export const listMyConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: me } = await supabaseAdmin.from("profiles").select("account_id, role").eq("id", userId).maybeSingle();
    if (!me?.account_id || (me.role !== "empresa" && me.role !== "sponsor")) return { myAccountId: null, myRole: me?.role ?? null, conversations: [] as ChatConversation[] };
    const isEmp = me.role === "empresa";
    const mine = isEmp ? "empresa_account_id" : "sponsor_account_id";
    const other = isEmp ? "sponsor_account_id" : "empresa_account_id";

    const [{ data: ms }, { data: mt }] = await Promise.all([
      supabaseAdmin.from("matches").select(other).eq(mine, me.account_id).eq("status", "mutual"),
      supabaseAdmin.from("meetings_1to1").select(`${other}, status`).eq(mine, me.account_id),
    ]);
    const origin = new Map<string, Set<string>>();
    (ms ?? []).forEach((r: any) => r[other] && (origin.get(r[other]) ?? origin.set(r[other], new Set()).get(r[other])!).add("match"));
    (mt ?? []).forEach((r: any) => r[other] && r.status !== "cancelled" && (origin.get(r[other]) ?? origin.set(r[other], new Set()).get(r[other])!).add("reunion"));
    const ids = [...origin.keys()];
    if (!ids.length) return { myAccountId: me.account_id, myRole: me.role, conversations: [] };

    const [{ data: accs }, { data: msgs }, { data: reads }] = await Promise.all([
      supabaseAdmin.from(isEmp ? "sponsor_profiles" : "empresa_profiles").select("id, company_name, logo_url").in("id", ids),
      supabaseAdmin.from("chat_messages").select("empresa_account_id, sponsor_account_id, sender_id, body, created_at").eq(mine, me.account_id).order("created_at", { ascending: false }).limit(1000),
      supabaseAdmin.from("chat_reads").select("partner_account_id, last_read_at").eq("user_id", userId),
    ]);
    const readMap = new Map((reads ?? []).map((r: any) => [r.partner_account_id, r.last_read_at]));
    const conversations: ChatConversation[] = ids.map((pid) => {
      const acc = (accs ?? []).find((a: any) => a.id === pid);
      const pm = (msgs ?? []).filter((m: any) => m[other] === pid);
      const lastRead = readMap.get(pid);
      const o = origin.get(pid)!;
      return {
        partnerAccountId: pid,
        partnerName: acc?.company_name ?? "Cuenta",
        partnerLogo: acc?.logo_url ?? null,
        empresaAccountId: isEmp ? me.account_id! : pid,
        sponsorAccountId: isEmp ? pid : me.account_id!,
        origin: o.size === 2 ? "ambos" : (o.has("match") ? "match" : "reunion"),
        lastMessage: pm[0]?.body ?? null,
        lastAt: pm[0]?.created_at ?? null,
        unread: pm.filter((m: any) => m.sender_id !== userId && (!lastRead || m.created_at > lastRead)).length,
      };
    });
    conversations.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "") || a.partnerName.localeCompare(b.partnerName, "es"));
    return { myAccountId: me.account_id, myRole: me.role, conversations };
  });
