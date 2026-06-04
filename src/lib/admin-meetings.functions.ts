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
            status: z.enum(["pending", "confirmed", "completed", "cancelled"]).optional(),
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

const responsableSchema = z.object({
  full_name: z.string().min(1).max(200),
  role: z.string().max(200).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
}).nullable().optional();

export const createMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      event_id: z.string().uuid().optional().nullable(),
      empresa_user_id: z.string().uuid(),
      sponsor_user_id: z.string().uuid(),
      scheduled_time: z.string().optional().nullable(),
      room: z.string().max(120).optional().nullable(),
      duration_minutes: z.number().int().min(5).max(180).optional(),
      empresa_responsable: responsableSchema,
      sponsor_responsable: responsableSchema,
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: m, error } = await supabaseAdmin
      .from("meetings_1to1")
      .insert({
        event_id: data.event_id ?? null,
        empresa_user_id: data.empresa_user_id,
        sponsor_user_id: data.sponsor_user_id,
        scheduled_time: data.scheduled_time ?? null,
        room: data.room ?? null,
        duration_minutes: data.duration_minutes ?? 15,
        status: data.scheduled_time ? "confirmed" : "pending",
        assigned_by: context.userId,
        empresa_responsable: data.empresa_responsable ?? null,
        sponsor_responsable: data.sponsor_responsable ?? null,
      })
      .select()
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return { meeting: m };
  });

export const listAllParticipants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const [{ data: emps }, { data: sps }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("empresa_profiles").select("user_id, company_name").order("company_name"),
      supabaseAdmin.from("sponsor_profiles").select("user_id, company_name").order("company_name"),
      supabaseAdmin.from("profiles").select("id, account_id, full_name, email, account_role, role, is_active"),
    ]);

    const ownerAccount = new Map<string, string>();
    const byAccount = new Map<string, any[]>();
    (profs ?? []).forEach((p: any) => {
      if (!p.account_id) return;
      if (p.is_active === false) return;
      const arr = byAccount.get(p.account_id) ?? [];
      arr.push(p);
      byAccount.set(p.account_id, arr);
      ownerAccount.set(p.id, p.account_id);
    });

    const buildResp = (ownerUserId: string) => {
      const accId = ownerAccount.get(ownerUserId);
      if (!accId) return [];
      const members = (byAccount.get(accId) ?? []).slice();
      members.sort((a, b) => (a.account_role === "owner" ? -1 : b.account_role === "owner" ? 1 : 0));
      return members.map((m: any) => ({
        profile_id: m.id,
        full_name: m.full_name ?? "(sin nombre)",
        role: m.account_role ?? "",
        email: m.email ?? "",
      }));
    };

    return {
      empresas: (emps ?? []).filter((e: any) => e.user_id).map((e: any) => ({
        user_id: e.user_id, name: e.company_name, responsables: buildResp(e.user_id),
      })),
      sponsors: (sps ?? []).filter((s: any) => s.user_id).map((s: any) => ({
        user_id: s.user_id, name: s.company_name, responsables: buildResp(s.user_id),
      })),
    };
  });
