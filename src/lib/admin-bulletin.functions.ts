import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSuperAdmin } from "./admin-shared.server";

const postSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  content: z.string().min(1).max(4000),
  scope: z.enum(["global", "event"]).default("global"),
  event_id: z.string().uuid().optional().nullable(),
});

export const listBulletin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        scope: z.enum(["all", "global", "event"]).default("all"),
        event_id: z.string().uuid().optional().nullable(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    let q = supabaseAdmin.from("bulletin_posts").select("*").order("created_at", { ascending: false });
    if (data.scope !== "all") q = q.eq("scope", data.scope);
    if (data.event_id) q = q.eq("event_id", data.event_id);
    const { data: posts, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });
    return { posts: posts ?? [] };
  });

export const createBulletin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => postSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.scope === "event" && !data.event_id) {
      throw new Response("Selecciona un evento para anuncios por evento", { status: 400 });
    }
    const payload = {
      title: data.title || null,
      content: data.content,
      scope: data.scope,
      event_id: data.scope === "event" ? data.event_id : null,
      author_id: context.userId,
    };
    const { data: post, error } = await supabaseAdmin.from("bulletin_posts").insert(payload).select().single();
    if (error) throw new Response(error.message, { status: 400 });
    return { post };
  });

export const updateBulletin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), patch: postSchema.partial() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: post, error } = await supabaseAdmin
      .from("bulletin_posts")
      .update(data.patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return { post };
  });

export const deleteBulletin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("bulletin_posts").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
