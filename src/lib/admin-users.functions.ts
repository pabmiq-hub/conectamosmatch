import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSuperAdmin } from "./admin-shared.server";

const empresaSchema = z.object({
  company_name: z.string().min(1).max(200),
  sector: z.string().max(120).optional().default(""),
  company_size: z.enum(["1-10", "11-50", "51-200", "201-500", "500+"]).optional(),
  website: z.string().max(300).optional().default(""),
  location_city: z.string().max(120).optional().default(""),
  linkedin_url: z.string().max(300).optional().default(""),
  tagline: z.string().max(300).optional().default(""),
  description: z.string().max(2000).optional().default(""),
});

const sponsorSchema = z.object({
  company_name: z.string().min(1).max(200),
  sector: z.string().max(120).optional().default(""),
  sponsorship_category: z.string().max(120).optional().default(""),
  sponsorship_level: z.enum(["PLATINUM", "GOLD", "SILVER", "BRONZE"]).default("BRONZE"),
  website: z.string().max(300).optional().default(""),
  linkedin_url: z.string().max(300).optional().default(""),
  tagline: z.string().max(300).optional().default(""),
  description: z.string().max(2000).optional().default(""),
});

const createSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  phone: z.string().max(40).optional().default(""),
  role: z.enum(["empresa", "sponsor"]),
  empresa: empresaSchema.optional(),
  sponsor: sponsorSchema.optional(),
});

async function createOne(d: z.infer<typeof createSchema>) {
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    user_metadata: { full_name: d.full_name, role: d.role },
  });
  if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear");
  const userId = created.user.id;

  let accountId: string | null = null;
  if (d.role === "empresa" && d.empresa) {
    const { data: prof, error: e } = await supabaseAdmin
      .from("empresa_profiles")
      .insert({ user_id: userId, ...d.empresa })
      .select("id")
      .single();
    if (e) throw new Error(e.message);
    accountId = prof.id;
  } else if (d.role === "sponsor" && d.sponsor) {
    const { data: prof, error: e } = await supabaseAdmin
      .from("sponsor_profiles")
      .insert({ user_id: userId, ...d.sponsor })
      .select("id")
      .single();
    if (e) throw new Error(e.message);
    accountId = prof.id;
  }

  await supabaseAdmin.from("profiles").upsert({
    id: userId,
    email: d.email,
    full_name: d.full_name,
    phone: d.phone,
    role: d.role,
    account_id: accountId,
    account_role: "owner",
  });

  return userId;
}

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const userId = await createOne(data);
    return { userId, email: data.email };
  });

// Add a "manager" responsable to an existing account
const inviteResponsableSchema = z.object({
  accountId: z.string().uuid(),
  accountType: z.enum(["empresa", "sponsor"]),
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  phone: z.string().max(40).optional().default(""),
});

export const inviteResponsable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteResponsableSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    // Verify account exists
    const table = data.accountType === "empresa" ? "empresa_profiles" : "sponsor_profiles";
    const { data: account, error: accErr } = await supabaseAdmin
      .from(table)
      .select("id")
      .eq("id", data.accountId)
      .maybeSingle();
    if (accErr || !account) throw new Error("La cuenta no existe");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, role: data.accountType },
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear");
    const userId = created.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      role: data.accountType,
      account_id: data.accountId,
      account_role: "manager",
    });

    return { userId, email: data.email };
  });

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const [{ data: emp }, { data: sp }] = await Promise.all([
      supabaseAdmin.from("empresa_profiles").select("id, company_name").order("company_name"),
      supabaseAdmin.from("sponsor_profiles").select("id, company_name").order("company_name"),
    ]);
    return {
      empresas: (emp ?? []).map((e: any) => ({ id: e.id, name: e.company_name })),
      sponsors: (sp ?? []).map((s: any) => ({ id: s.id, name: s.company_name })),
    };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    await supabaseAdmin.from("profiles").update({ is_active: data.isActive }).eq("id", data.userId);
    return { ok: true };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.userId === context.userId) {
      throw new Response("No puedes eliminar tu propia cuenta", { status: 400 });
    }
    // Only owners delete the account profile rows. Managers just lose their auth user.
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("account_role")
      .eq("id", data.userId)
      .maybeSingle();
    if (prof?.account_role === "owner") {
      await supabaseAdmin.from("empresa_profiles").delete().eq("user_id", data.userId);
      await supabaseAdmin.from("sponsor_profiles").delete().eq("user_id", data.userId);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

const optStr = z.preprocess(
  (v) => (v === undefined || v === null ? "" : String(v)),
  z.string().optional().default(""),
);
const accountTypeSchema = z.preprocess((v) => {
  const s = typeof v === "string" ? v.trim().toLowerCase() : v;
  if (s === "sponsor" || s === "patrocinador") return "sponsor";
  return "empresa"; // default — Excel "role" column is treated as job title
}, z.enum(["empresa", "sponsor"]));

const bulkRowSchema = z.object({
  full_name: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().min(1)),
  email: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().email()),
  password: z.preprocess(
    (v) => {
      const s = v == null ? "" : String(v);
      return s.length >= 8 ? s : `Cambiar${Math.random().toString(36).slice(2, 10)}!`;
    },
    z.string().min(8),
  ),
  // account_type column drives the role; legacy "role" column is now job title (ignored for routing)
  account_type: accountTypeSchema.optional(),
  role: optStr, // job title (free text), preserved but unused for routing
  phone: optStr,
  company_name: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().min(1)),
  sector: optStr,
  website: optStr,
  linkedin_url: optStr,
  tagline: optStr,
  description: optStr,
  // empresa
  company_size: z.enum(["1-10", "11-50", "51-200", "201-500", "500+"]).optional(),
  location_city: optStr,
  // sponsor
  sponsorship_category: optStr,
  sponsorship_level: z.enum(["PLATINUM", "GOLD", "SILVER", "BRONZE"]).optional(),
});


export const bulkImportUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const ok: string[] = [];
    const failed: { email: string; error: string }[] = [];
    for (const raw of data.rows) {
      try {
        const r = bulkRowSchema.parse(raw);
        await createOne({
          full_name: r.full_name,
          email: r.email,
          password: r.password,
          phone: r.phone,
          role: r.role,
          empresa:
            r.role === "empresa"
              ? {
                  company_name: r.company_name,
                  sector: r.sector,
                  company_size: r.company_size,
                  website: r.website,
                  location_city: r.location_city,
                  linkedin_url: r.linkedin_url,
                  tagline: r.tagline,
                  description: r.description,
                }
              : undefined,
          sponsor:
            r.role === "sponsor"
              ? {
                  company_name: r.company_name,
                  sector: r.sector,
                  sponsorship_category: r.sponsorship_category,
                  sponsorship_level: r.sponsorship_level ?? "BRONZE",
                  website: r.website,
                  linkedin_url: r.linkedin_url,
                  tagline: r.tagline,
                  description: r.description,
                }
              : undefined,
        });
        ok.push(r.email);
      } catch (e: any) {
        failed.push({ email: String(raw.email ?? "(?)"), error: e?.message ?? "Error desconocido" });
      }
    }
    return { ok, failed };
  });
