import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { receivedInterest, type DirectoryMode } from "./directory-order";

const selection = z.object({ eventId: z.string().uuid(), kind: z.enum(["empresa", "sponsor"]) });

export const getDirectoryOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => selection.parse(input))
  .handler(async ({ data, context }) => {
    const { getEventScope, fetchAll } = await import("./event-scope.server");
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (roleError) throw new Error(roleError.message);
    const { data: myAccount, error: accountError } = await context.supabase.rpc("my_account_id");
    if (accountError) throw new Error(accountError.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Resolve membership via the same account/event definition used by all participant panels.
    // No settings or interest aggregates are returned until the caller is authorized.
    const scope = await getEventScope(supabaseAdmin, data.eventId);
    if (!admin && !scope.userIds.has(context.userId) && !(myAccount && scope.accountIds.has(myAccount))) throw new Error("No tienes acceso a este evento.");
    const { data: settings, error } = await context.supabase.from("event_directory_order")
      .select("sort_mode").eq("event_id", data.eventId).eq("target_kind", data.kind).maybeSingle();
    if (error) throw new Error(error.message);
    const mode = (settings?.sort_mode ?? "alphabetical") as DirectoryMode;
    if (mode === "alphabetical" || mode === "random") return { mode, counts: {} as Record<string, number> };
    const [likes, profiles] = await Promise.all([
      fetchAll<{ from_user_id: string | null; to_user_id: string | null }>((a, b) => supabaseAdmin.from("likes").select("from_user_id,to_user_id").eq("event_id", data.eventId).order("id").range(a, b)),
      fetchAll<{ id: string; account_id: string | null }>((a, b) => supabaseAdmin.from("profiles").select("id,account_id").order("id").range(a, b)),
    ]);
    const counts = receivedInterest(likes, profiles, scope.accountIds);
    const targetIds = data.kind === "empresa" ? scope.empresaAccountIds : scope.sponsorAccountIds;
    return { mode, counts: Object.fromEntries([...targetIds].map((id) => [id, counts[id] ?? 0])) };
  });

export const setDirectoryOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => selection.extend({ mode: z.enum(["alphabetical", "most_interest", "least_interest", "random"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (roleError || !allowed) throw new Error("Sólo el superadministrador puede cambiar el orden.");
    const { error } = await context.supabase.from("event_directory_order").upsert({ event_id: data.eventId, target_kind: data.kind, sort_mode: data.mode }, { onConflict: "event_id,target_kind" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });