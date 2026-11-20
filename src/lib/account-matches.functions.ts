import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Returns mutual matches at the ACCOUNT level for the current user.
// Any match involving any teammate of the user's account is included.
export const listMyAccountMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid().nullable().optional() }).parse(input ?? {}))
  .handler(async ({ context, data: input }) => {
    const { userId } = context;
    const supabaseAdmin = context.supabase;
    const { fetchAll } = await import("./event-scope.server");

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

    const matches = await fetchAll<any>((a, b) => {
      let mq = supabaseAdmin.from("matches").select(`${partnerUserField}, ${partnerAccountField}`).eq(filterField, myAccountId).eq("status", "mutual").order("id").range(a, b);
      if (input.eventId !== undefined) mq = input.eventId ? mq.eq("event_id", input.eventId) : mq.is("event_id", null);
      return mq;
    });

    const partnerUserIds = Array.from(new Set((matches ?? []).map((m: any) => m[partnerUserField]).filter(Boolean)));
    const partnerAccountIds = Array.from(new Set((matches ?? []).map((m: any) => m[partnerAccountField]).filter(Boolean)));
    return { partnerUserIds, partnerAccountIds };
  });
