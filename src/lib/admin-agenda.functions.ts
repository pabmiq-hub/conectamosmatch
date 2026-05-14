import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSuperAdmin } from "./admin-shared.server";

const itemSchema = z.object({
  event_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(""),
  speaker_name: z.string().max(200).optional().default(""),
  speaker_role: z.string().max(200).optional().default(""),
  room: z.string().max(120).optional().default(""),
  agenda_type: z.enum(["bienvenida", "charla", "panel", "coffee_break", "comida", "networking", "reuniones_1to1", "cierre"]).optional().nullable(),
  event_date: z.string().optional().nullable(),
  time_start: z.string().optional().nullable(),
  time_end: z.string().optional().nullable(),
  order_index: z.number().int().default(0),
});

export const listAgenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: items, error } = await supabaseAdmin
      .from("event_agenda")
      .select("*")
      .eq("event_id", data.event_id)
      .order("order_index");
    if (error) throw new Response(error.message, { status: 400 });
    return { items: items ?? [] };
  });

export const createAgendaItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => itemSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: item, error } = await supabaseAdmin.from("event_agenda").insert(data).select().single();
    if (error) throw new Response(error.message, { status: 400 });
    return { item };
  });

export const updateAgendaItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), patch: itemSchema.partial() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: item, error } = await supabaseAdmin
      .from("event_agenda")
      .update(data.patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return { item };
  });

export const deleteAgendaItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("event_agenda").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
