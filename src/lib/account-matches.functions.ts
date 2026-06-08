import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Returns mutual matches at the ACCOUNT level for the current user.
// Any match involving any teammate of the user's account is included.
export const listMyAccountMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: meProfile } = await supabaseAdmin
      .from("profiles")
      .select("account_id, role")
      .eq("id", userId)
      .maybeSingle();
    const myAccountId = meProfile?.account_id ?? null;
    const myRole = meProfile?.role ?? null;
    if (!myAccountId || !myRole) return { partnerUserIds: [] as string[], partnerAccountIds: [] as string[] };

    const filterField = myRole === "empresa" ? "empresa_account_id" : "sponsor_account_id";
    const partnerUserField = myRole === "empresa" ? "sponsor_user_id" : "empresa_user_id";
    const partnerAccountField = myRole === "empresa" ? "sponsor_account_id" : "empresa_account_id";

    const { data: matches, error } = await supabaseAdmin
      .from("matches")
      .select(`${partnerUserField}, ${partnerAccountField}`)
      .eq(filterField, myAccountId)
      .eq("status", "mutual");
    if (error) throw new Error(error.message);

    const partnerUserIds = Array.from(new Set((matches ?? []).map((m: any) => m[partnerUserField]).filter(Boolean)));
    const partnerAccountIds = Array.from(new Set((matches ?? []).map((m: any) => m[partnerAccountField]).filter(Boolean)));
    return { partnerUserIds, partnerAccountIds };
  });
