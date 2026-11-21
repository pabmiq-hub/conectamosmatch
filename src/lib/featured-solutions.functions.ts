import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listFeaturedSolutions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("event_featured_solutions")
      .select("event_id, sponsor_account_id").eq("event_id", data.eventId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setFeaturedSolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid(), accountId: z.string().uuid(), featured: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (roleError || !allowed) throw new Error("Sólo el superadministrador puede destacar soluciones.");
    const query = context.supabase.from("event_featured_solutions");
    const { error } = data.featured
      ? await query.upsert({ event_id: data.eventId, sponsor_account_id: data.accountId }, { onConflict: "event_id,sponsor_account_id", ignoreDuplicates: true })
      : await query.delete().eq("event_id", data.eventId).eq("sponsor_account_id", data.accountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });