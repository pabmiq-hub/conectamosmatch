import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSuperAdmin } from "./admin-shared.server";

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().max(120).optional().nullable(),
  description: z.string().max(2000).optional().default(""),
  status: z.enum(["draft", "published", "ongoing", "finished", "cancelled"]).default("draft"),
  event_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  location_name: z.string().max(200).optional().default(""),
  location_address: z.string().max(300).optional().default(""),
  location_city: z.string().max(120).optional().default(""),
  is_virtual: z.boolean().default(false),
  virtual_url: z.string().max(300).optional().default(""),
  cover_image_url: z.string().max(500).optional().default(""),
  max_empresas: z.number().int().min(0).optional().nullable(),
  max_sponsors: z.number().int().min(0).optional().nullable(),
  rooms: z.array(z.string().min(1).max(100)).min(1).default(["Sala A"]),
  meetings_per_user: z.number().int().min(1).max(50).default(8),
  slot_duration_minutes: z.number().int().min(5).max(180).default(30),
  meetings_start_at: z.string().optional().nullable(),
  meetings_end_at: z.string().optional().nullable(),
  max_likes_per_user: z.number().int().min(1).max(500).default(20),
});

export const listEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("*")
      .order("event_date", { ascending: false });
    if (error) throw new Response(error.message, { status: 400 });
    return { events: data ?? [] };
  });

export const getEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: ev, error } = await supabaseAdmin.from("events").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Response(error.message, { status: 400 });
    return { event: ev };
  });

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => eventSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: ev, error } = await supabaseAdmin
      .from("events")
      .insert({ ...data, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return { event: ev };
  });

export const updateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), patch: eventSchema.partial() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: ev, error } = await supabaseAdmin
      .from("events")
      .update(data.patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return { event: ev };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    // Cascade: clear dependent rows first
    await supabaseAdmin.from("meetings_1to1").delete().eq("event_id", data.id);
    await supabaseAdmin.from("matches").delete().eq("event_id", data.id);
    await supabaseAdmin.from("likes").delete().eq("event_id", data.id);
    await supabaseAdmin.from("event_registrations").delete().eq("event_id", data.id);
    await supabaseAdmin.from("event_agenda").delete().eq("event_id", data.id);
    await supabaseAdmin.from("bulletin_posts").delete().eq("event_id", data.id);
    const { error } = await supabaseAdmin.from("events").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
