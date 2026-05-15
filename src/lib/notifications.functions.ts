import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ unreadOnly: z.boolean().optional(), limit: z.number().int().min(1).max(50).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(data.limit ?? 15);
    if (data.unreadOnly) q = q.eq("is_read", false);
    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });
    return { notifications: rows ?? [] };
  });

export const getUnreadCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { count, error } = await supabase
      .from("notifications").select("*", { count: "exact", head: true })
      .eq("user_id", userId).eq("is_read", false);
    if (error) throw new Response(error.message, { status: 400 });
    return { count: count ?? 0 };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", data.id).eq("user_id", userId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
