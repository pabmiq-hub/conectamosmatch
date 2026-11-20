import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { countScheduledMeetings, uniquePartnerAccounts } from "./account-activity";

export const getAccountDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid().nullable() }).parse(input))
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    const { data: me, error } = await db.from("profiles").select("account_id, role").eq("id", context.userId).single();
    if (error) throw new Error(error.message);
    if (!me.account_id || (me.role !== "empresa" && me.role !== "sponsor")) return { name: "", level: "BASIC", matches: 0, meetings: 0 };
    const table = me.role === "empresa" ? "empresa_profiles" : "sponsor_profiles";
    const { data: account, error: accountError } = await db.from(table).select("*").eq("id", me.account_id).single();
    if (accountError) throw new Error(accountError.message);
    const result = { name: account.company_name, level: "sponsorship_level" in account ? account.sponsorship_level ?? "BASIC" : "BASIC", matches: 0, meetings: 0 };
    if (!data.eventId) return result;
    const field = me.role === "empresa" ? "empresa_account_id" : "sponsor_account_id";
    const other = me.role === "empresa" ? "sponsor_account_id" : "empresa_account_id";
    const { fetchAll } = await import("./event-scope.server");
    const [matches, meetings] = await Promise.all([
      fetchAll<any>((a, b) => db.from("matches").select("empresa_account_id, sponsor_account_id").eq(field, me.account_id as string).eq("event_id", data.eventId as string).eq("status", "mutual").order("id").range(a, b)),
      fetchAll<any>((a, b) => db.from("meetings_1to1").select("scheduled_time, status").eq(field, me.account_id as string).eq("event_id", data.eventId as string).order("id").range(a, b)),
    ]);
    return { ...result, matches: uniquePartnerAccounts(matches.map((m) => m[other])).length, meetings: countScheduledMeetings(meetings) };
  });