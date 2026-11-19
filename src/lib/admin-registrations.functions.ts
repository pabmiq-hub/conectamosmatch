import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSuperAdmin } from "./admin-shared.server";

export const listRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: regs, error } = await supabaseAdmin
      .from("event_registrations")
      .select("*")
      .eq("event_id", data.event_id)
      .order("registered_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 400 });
    return { registrations: regs ?? [] };
  });

export const toggleCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), checkedIn: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const patch: { checked_in_at: string | null; status: "attended" | "registered" } = data.checkedIn
      ? { checked_in_at: new Date().toISOString(), status: "attended" }
      : { checked_in_at: null, status: "registered" };
    const { error } = await supabaseAdmin.from("event_registrations").update(patch).eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const updateRegistrationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["registered", "confirmed", "attended", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("event_registrations")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const deleteRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("event_registrations").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

/** Counts for the event summary: participating accounts, matches and scheduled meetings of that event only. */
export const getEventSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { getEventScope } = await import("./event-scope.server");
    const scope = await getEventScope(supabaseAdmin, data.event_id);
    const [mc, mtc] = await Promise.all([
      supabaseAdmin.from("matches").select("id", { count: "exact", head: true }).eq("event_id", data.event_id).eq("status", "mutual"),
      supabaseAdmin.from("meetings_1to1").select("id", { count: "exact", head: true }).eq("event_id", data.event_id).not("scheduled_time", "is", null).neq("status", "cancelled"),
    ]);
    return {
      empresas: scope.empresaAccountIds.size,
      sponsors: scope.sponsorAccountIds.size,
      matches: mc.count ?? 0,
      meetings: mtc.count ?? 0,
    };
  });

/** All empresa / solución accounts, flagged with whether they already take part in the event. */
export const listAccountsForEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { getEventScope } = await import("./event-scope.server");
    const scope = await getEventScope(supabaseAdmin, data.event_id);
    const [{ data: emps }, { data: sps }] = await Promise.all([
      supabaseAdmin.from("empresa_profiles").select("id, company_name").order("company_name"),
      supabaseAdmin.from("sponsor_profiles").select("id, company_name").order("company_name"),
    ]);
    return {
      accounts: [
        ...(emps ?? []).map((e: any) => ({ id: e.id, name: e.company_name, kind: "empresa" as const, inEvent: scope.accountIds.has(e.id) })),
        ...(sps ?? []).map((s: any) => ({ id: s.id, name: s.company_name, kind: "sponsor" as const, inEvent: scope.accountIds.has(s.id) })),
      ],
    };
  });

/** Registers every active member of the chosen accounts in the event. */
export const addAccountsToEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ event_id: z.string().uuid(), account_ids: z.array(z.string().uuid()).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const [{ data: members }, { data: emps }, { data: sps }, { data: existing }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email, cargo, role, account_id, is_active").in("account_id", data.account_ids),
      supabaseAdmin.from("empresa_profiles").select("id, company_name").in("id", data.account_ids),
      supabaseAdmin.from("sponsor_profiles").select("id, company_name").in("id", data.account_ids),
      supabaseAdmin.from("event_registrations").select("id, user_id, status").eq("event_id", data.event_id),
    ]);
    const company = new Map<string, { name: string; kind: "empresa" | "sponsor" }>();
    (emps ?? []).forEach((e: any) => company.set(e.id, { name: e.company_name, kind: "empresa" }));
    (sps ?? []).forEach((s: any) => company.set(s.id, { name: s.company_name, kind: "sponsor" }));
    const byUser = new Map((existing ?? []).map((r: any) => [r.user_id, r]));
    const toInsert: any[] = [];
    const toRevive: string[] = [];
    for (const m of members ?? []) {
      if (m.is_active === false) continue;
      const acc = m.account_id ? company.get(m.account_id) : undefined;
      if (!acc) continue;
      const reg: any = byUser.get(m.id);
      if (reg) { if (reg.status === "cancelled") toRevive.push(reg.id); continue; }
      toInsert.push({
        event_id: data.event_id, user_id: m.id, role_at_event: acc.kind, status: "confirmed",
        attendee_name: m.full_name, attendee_email: m.email, attendee_company: acc.name, attendee_role_title: m.cargo ?? null,
      });
    }
    if (toInsert.length) {
      const { error } = await supabaseAdmin.from("event_registrations").insert(toInsert);
      if (error) throw new Response(error.message, { status: 400 });
    }
    if (toRevive.length) await supabaseAdmin.from("event_registrations").update({ status: "confirmed" }).in("id", toRevive);
    return { added: toInsert.length + toRevive.length };
  });
