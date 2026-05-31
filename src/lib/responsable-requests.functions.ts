import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSuperAdmin } from "./admin-shared.server";

export interface ResponsableRequest {
  id: string;
  account_id: string;
  account_type: "empresa" | "sponsor";
  account_name: string | null;
  requested_by: string;
  requester_name: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  cargo?: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const createSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional().default(""),
  cargo: z.string().max(120).optional().default(""),
});

export const requestResponsable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("account_id, account_role, role")
      .eq("id", userId)
      .maybeSingle();
    if (!me?.account_id) throw new Error("Tu cuenta no está asociada a una empresa/solución");
    if (me.account_role !== "owner") throw new Error("Solo el owner puede solicitar responsables");
    if (me.role !== "empresa" && me.role !== "sponsor") throw new Error("Cuenta inválida");

    // Reject duplicates (email already pending for this account)
    const { data: dup } = await supabase
      .from("responsable_requests")
      .select("id")
      .eq("account_id", me.account_id)
      .eq("email", data.email)
      .eq("status", "pending")
      .maybeSingle();
    if (dup) throw new Error("Ya existe una solicitud pendiente para ese email");

    const { error } = await supabase.from("responsable_requests").insert({
      account_id: me.account_id,
      account_type: me.role,
      requested_by: userId,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone || null,
      cargo: data.cargo || null,
    });
    if (error) throw new Error(error.message);

    // Notify super admins
    const { data: admins } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "super_admin");
    if (admins?.length) {
      await supabaseAdmin.from("notifications").insert(
        admins.map((a) => ({
          user_id: a.id,
          type: "responsable_request",
          title: "Nueva solicitud de responsable",
          body: `${data.full_name} (${data.email})`,
          link: "/admin/usuarios",
        })),
      );
    }
    return { ok: true };
  });

export const listMyAccountRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("id", userId)
      .maybeSingle();
    if (!me?.account_id) return [];
    const { data } = await supabase
      .from("responsable_requests")
      .select("id, full_name, email, phone, cargo, status, rejection_reason, created_at, reviewed_at")
      .eq("account_id", me.account_id)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const cancelMyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("responsable_requests")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("requested_by", userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResponsableRequest[]> => {
    await assertSuperAdmin(context.userId);
    const { data: reqs } = await supabaseAdmin
      .from("responsable_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!reqs?.length) return [];

    const empIds = reqs.filter((r) => r.account_type === "empresa").map((r) => r.account_id);
    const spoIds = reqs.filter((r) => r.account_type === "sponsor").map((r) => r.account_id);
    const reqIds = Array.from(new Set(reqs.map((r) => r.requested_by)));

    const [{ data: emps }, { data: spos }, { data: profs }] = await Promise.all([
      empIds.length ? supabaseAdmin.from("empresa_profiles").select("id, company_name").in("id", empIds) : Promise.resolve({ data: [] }),
      spoIds.length ? supabaseAdmin.from("sponsor_profiles").select("id, company_name").in("id", spoIds) : Promise.resolve({ data: [] }),
      supabaseAdmin.from("profiles").select("id, full_name").in("id", reqIds),
    ]);
    const empMap = new Map((emps ?? []).map((e: any) => [e.id, e.company_name]));
    const spoMap = new Map((spos ?? []).map((s: any) => [s.id, s.company_name]));
    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));

    return reqs.map((r: any) => ({
      ...r,
      account_name: r.account_type === "empresa" ? empMap.get(r.account_id) ?? null : spoMap.get(r.account_id) ?? null,
      requester_name: profMap.get(r.requested_by) ?? null,
    }));
  });

export const approveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), password: z.string().min(8).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: req, error: rErr } = await supabaseAdmin
      .from("responsable_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (rErr || !req) throw new Error("Solicitud no encontrada");
    if (req.status !== "pending") throw new Error("La solicitud ya no está pendiente");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: req.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: req.full_name, role: req.account_type },
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear el usuario");

    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      email: req.email,
      full_name: req.full_name,
      phone: req.phone,
      cargo: (req as any).cargo ?? null,
      role: req.account_type as "empresa" | "sponsor",
      account_id: req.account_id,
      account_role: "manager",
    });

    await supabaseAdmin
      .from("responsable_requests")
      .update({ status: "approved", reviewed_by: context.userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.id);

    await supabaseAdmin.from("notifications").insert({
      user_id: req.requested_by,
      type: "responsable_approved",
      title: "Responsable aprobado",
      body: `${req.full_name} ya puede acceder con ${req.email}`,
      link: req.account_type === "empresa" ? "/empresa/equipo" : "/sponsor/equipo",
    });

    return { ok: true };
  });

export const rejectRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional().default("") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: req } = await supabaseAdmin
      .from("responsable_requests")
      .select("requested_by, full_name, account_type")
      .eq("id", data.id)
      .maybeSingle();
    if (!req) throw new Error("Solicitud no encontrada");

    await supabaseAdmin
      .from("responsable_requests")
      .update({
        status: "rejected",
        rejection_reason: data.reason || null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    await supabaseAdmin.from("notifications").insert({
      user_id: req.requested_by,
      type: "responsable_rejected",
      title: "Solicitud rechazada",
      body: data.reason ? `${req.full_name}: ${data.reason}` : `Solicitud de ${req.full_name} rechazada`,
      link: req.account_type === "empresa" ? "/empresa/equipo" : "/sponsor/equipo",
    });

    return { ok: true };
  });
