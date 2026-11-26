import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import base from "@/data/talks-conectamos27h.json";

export const listEventTalks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (error || !allowed) throw new Error("Solo los superadministradores pueden gestionar Talks");
    const { readEventTalks } = await import("./talk-attendance.server");
    return { talks: await readEventTalks(context.supabase, data.event_id) };
  });

export const removeTalkPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    event_id: z.string().uuid(), talk_id: z.string().min(1), person_name: z.string().min(1), company_name: z.string().min(1),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (error || !allowed) throw new Error("Solo los superadministradores pueden gestionar Talks");
    if (data.event_id !== base.eventId || !base.talks.some((t) => t.id === data.talk_id && t.people.some((p) => p.name === data.person_name && p.empresa === data.company_name))) {
      throw new Error("Esta persona no está asignada a ese Talk en este evento");
    }
    const { error: saveError } = await context.supabase.from("event_talk_exclusions")
      .upsert({ ...data, removed_by: context.userId }, { onConflict: "event_id,talk_id,person_name,company_name", ignoreDuplicates: true });
    if (saveError) throw new Error("No se ha podido quitar a la persona del Talk");
    return { ok: true };
  });