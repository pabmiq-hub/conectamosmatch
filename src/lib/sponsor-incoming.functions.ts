import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type IncomingEmpresa = {
  account_id: string;
  user_id: string | null;
  company_name: string;
  description: string | null;
  logo_url: string | null;
  sector: string | null;
  company_size: string | null;
  website: string | null;
  location_city: string | null;
  responsables: any;
  via_responsables: string[]; // names of responsables (in the empresa account) who liked us
  liked_responsables: string[]; // names of responsables (in our sponsor account) who were liked
  created_at: string | null; // most recent like
  matched: boolean;
};

export const listEmpresasWhoLikedMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: IncomingEmpresa[] }> => {
    const { userId } = context;

    // Find the sponsor account of the current user
    const { data: meProfile } = await supabaseAdmin
      .from("profiles")
      .select("account_id")
      .eq("id", userId)
      .maybeSingle();
    const myAccountId = meProfile?.account_id;
    if (!myAccountId) return { items: [] };

    // Confirm it's a sponsor account
    const { data: sp } = await supabaseAdmin
      .from("sponsor_profiles")
      .select("id")
      .eq("id", myAccountId)
      .maybeSingle();
    if (!sp) return { items: [] };

    // All members (responsables) of my sponsor account
    const { data: myMembers } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("account_id", myAccountId);
    const myMemberIds = (myMembers ?? []).map((m: any) => m.id);
    const myMemberNameById = new Map<string, string>(
      (myMembers ?? []).map((m: any) => [m.id, m.full_name || "Responsable"]),
    );
    if (!myMemberIds.length) return { items: [] };

    // Likes received by any of my responsables
    const { data: likes } = await supabaseAdmin
      .from("likes")
      .select("from_user_id, to_user_id, created_at")
      .in("to_user_id", myMemberIds)
      .order("created_at", { ascending: false });
    const senderIds = Array.from(new Set((likes ?? []).map((l: any) => l.from_user_id).filter(Boolean)));
    if (!senderIds.length) return { items: [] };

    // Resolve sender profiles -> account
    const { data: senderProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, account_id, full_name")
      .in("id", senderIds);
    const senderById = new Map<string, { account_id: string | null; name: string }>(
      (senderProfiles ?? []).map((p: any) => [p.id, { account_id: p.account_id, name: p.full_name || "Responsable" }]),
    );

    // Aggregate by empresa account
    const agg = new Map<string, { via: Set<string>; liked: Set<string>; created_at: string | null }>();
    (likes ?? []).forEach((l: any) => {
      const sender = senderById.get(l.from_user_id);
      if (!sender || !sender.account_id) return;
      const accId = sender.account_id;
      let a = agg.get(accId);
      if (!a) { a = { via: new Set(), liked: new Set(), created_at: l.created_at }; agg.set(accId, a); }
      a.via.add(sender.name);
      const liked = myMemberNameById.get(l.to_user_id);
      if (liked) a.liked.add(liked);
      if (l.created_at && (!a.created_at || l.created_at > a.created_at)) a.created_at = l.created_at;
    });

    const accountIds = Array.from(agg.keys());
    if (!accountIds.length) return { items: [] };

    const { data: empresas } = await supabaseAdmin
      .from("empresa_profiles")
      .select("id, user_id, company_name, description, logo_url, sector, company_size, website, location_city, responsables")
      .in("id", accountIds);

    // Matches between me (account) and these empresas
    const { data: matches } = await supabaseAdmin
      .from("matches")
      .select("empresa_account_id")
      .eq("sponsor_account_id", myAccountId)
      .eq("status", "mutual");
    const matchedAccounts = new Set((matches ?? []).map((m: any) => m.empresa_account_id));

    const items: IncomingEmpresa[] = (empresas ?? []).map((e: any) => {
      const a = agg.get(e.id)!;
      return {
        account_id: e.id,
        user_id: e.user_id,
        company_name: e.company_name,
        description: e.description,
        logo_url: e.logo_url,
        sector: e.sector,
        company_size: e.company_size,
        website: e.website,
        location_city: e.location_city,
        responsables: e.responsables,
        via_responsables: Array.from(a.via).sort((x, y) => x.localeCompare(y, "es")),
        liked_responsables: Array.from(a.liked).sort((x, y) => x.localeCompare(y, "es")),
        created_at: a.created_at,
        matched: matchedAccounts.has(e.id),
      };
    });

    items.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    return { items };
  });
