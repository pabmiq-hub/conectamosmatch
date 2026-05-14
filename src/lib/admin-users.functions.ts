import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || data.role !== "super_admin") {
    throw new Response("Forbidden: super admin only", { status: 403 });
  }
}

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

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, role: data.role },
    });
    if (error || !created.user) {
      throw new Response(error?.message ?? "No se pudo crear el usuario", { status: 400 });
    }
    const userId = created.user.id;

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email: data.email, full_name: data.full_name, phone: data.phone, role: data.role });

    if (data.role === "empresa" && data.empresa) {
      await supabaseAdmin.from("empresa_profiles").upsert({ user_id: userId, ...data.empresa });
    } else if (data.role === "sponsor" && data.sponsor) {
      await supabaseAdmin.from("sponsor_profiles").upsert({ user_id: userId, ...data.sponsor });
    }

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
