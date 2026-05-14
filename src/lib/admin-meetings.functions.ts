import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSuperAdmin } from "./admin-shared.server";

export const listMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ event_id: z.string().uuid().optional().nullable() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    let q = supabaseAdmin.from("meetings_1to1").select("*").order("scheduled_time", { ascending: true, nullsFirst: false });
    if (data.event_id) q = q.eq("event_id", data.event_id);
    const { data: meetings, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });

    const empIds = Array.from(new Set((meetings ?? []).map((m: any) => m.empresa_user_id).filter(Boolean)));
    const spIds = Array.from(new Set((meetings ?? []).map((m: any) => m.sponsor_user_id).filter(Boolean)));
    const [{ data: emps }, { data: sps }] = await Promise.all([
      supabaseAdmin.from("empresa_profiles").select("user_id, company_name").in("user_id", empIds.length ? empIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("sponsor_profiles").select("user_id, company_name").in("user_id", spIds.length ? spIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const eMap = new Map((emps ?? []).map((e: any) => [e.user_id, e]));
    const sMap = new Map((sps ?? []).map((s: any) => [s.user_id, s]));
    return {
      meetings: (meetings ?? []).map((m: any) => ({
        ...m,
        empresa_name: eMap.get(m.empresa_user_id)?.company_name ?? "—",
        sponsor_name: sMap.get(m.sponsor_user_id)?.company_name ?? "—",
      })),
    };
  });

export const autoAssignSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: result, error } = await supabaseAdmin.rpc("assign_meeting_slots", { p_event_id: data.event_id });
    if (error) throw new Response(error.message, { status: 400 });
    const row = Array.isArray(result) ? result[0] : result;
    return { assigned: row?.assigned ?? 0, skipped: row?.skipped ?? 0 };
  });

export const updateMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            scheduled_time: z.string().optional().nullable(),
            room: z.string().max(120).optional().nullable(),
            duration_minutes: z.number().int().min(5).max(180).optional(),
            status: z.enum(["pending", "scheduled", "completed", "cancelled", "no_show"]).optional(),
            notes: z.string().max(2000).optional().nullable(),
          })
          .partial(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: m, error } = await supabaseAdmin
      .from("meetings_1to1")
      .update({ ...data.patch, assigned_by: context.userId })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return { meeting: m };
  });

export const deleteMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("meetings_1to1").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
