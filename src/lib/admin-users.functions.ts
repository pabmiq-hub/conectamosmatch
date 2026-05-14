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
  await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, email: d.email, full_name: d.full_name, phone: d.phone, role: d.role });
  if (d.role === "empresa" && d.empresa) {
    await supabaseAdmin.from("empresa_profiles").upsert({ user_id: userId, ...d.empresa });
  } else if (d.role === "sponsor" && d.sponsor) {
    await supabaseAdmin.from("sponsor_profiles").upsert({ user_id: userId, ...d.sponsor });
  }
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
    await supabaseAdmin.from("empresa_profiles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("sponsor_profiles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

const bulkRowSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["empresa", "sponsor"]),
  phone: z.string().optional().default(""),
  company_name: z.string().min(1),
  sector: z.string().optional().default(""),
  website: z.string().optional().default(""),
  linkedin_url: z.string().optional().default(""),
  tagline: z.string().optional().default(""),
  description: z.string().optional().default(""),
  // empresa
  company_size: z.enum(["1-10", "11-50", "51-200", "201-500", "500+"]).optional(),
  location_city: z.string().optional().default(""),
  // sponsor
  sponsorship_category: z.string().optional().default(""),
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
