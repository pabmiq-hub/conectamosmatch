import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
  account_role: string;
  is_active: boolean;
  meetings: Array<{
    id: string;
    scheduled_time: string | null;
    room: string | null;
    status: string | null;
    partner_name: string | null;
  }>;
}

export const listMyTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeamMember[]> => {
    const { supabase, userId } = context;

    // Find current account_id
    const { data: me } = await supabase
      .from("profiles")
      .select("account_id, role")
      .eq("id", userId)
      .maybeSingle();
    if (!me?.account_id) return [];

    const { data: members } = await supabase
      .from("profiles")
      .select("id, full_name, email, account_role, is_active")
      .eq("account_id", me.account_id)
      .order("account_role", { ascending: true });

    const ids = (members ?? []).map((m) => m.id);
    if (!ids.length) return [];

    const partnerColumn = me.role === "empresa" ? "sponsor_user_id" : "empresa_user_id";
    const ownColumn = me.role === "empresa" ? "empresa_user_id" : "sponsor_user_id";

    const { data: meetings } = await supabase
      .from("meetings_1to1")
      .select(`id, scheduled_time, room, status, ${ownColumn}, ${partnerColumn}`)
      .in(ownColumn, ids)
      .order("scheduled_time", { ascending: true });

    // Resolve partner names
    const partnerIds = Array.from(new Set((meetings ?? []).map((m: any) => m[partnerColumn]).filter(Boolean)));
    const partnerTable = me.role === "empresa" ? "sponsor_profiles" : "empresa_profiles";
    const { data: partners } = partnerIds.length
      ? await supabase.from(partnerTable).select("user_id, company_name").in("user_id", partnerIds)
      : { data: [] as any[] };
    const partnerMap = new Map((partners ?? []).map((p: any) => [p.user_id, p.company_name]));

    return (members ?? []).map((m) => ({
      id: m.id,
      full_name: m.full_name,
      email: m.email,
      account_role: m.account_role,
      is_active: m.is_active ?? true,
      meetings: (meetings ?? [])
        .filter((mt: any) => mt[ownColumn] === m.id)
        .map((mt: any) => ({
          id: mt.id,
          scheduled_time: mt.scheduled_time,
          room: mt.room,
          status: mt.status,
          partner_name: partnerMap.get(mt[partnerColumn]) ?? null,
        })),
    }));
  });
