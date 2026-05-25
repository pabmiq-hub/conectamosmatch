import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  website: z.string().max(300).optional().default(""),
  linkedin_url: z.string().max(300).optional().default(""),
  tagline: z.string().max(300).optional().default(""),
  description: z.string().max(2000).optional().default(""),
});

const schema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  phone: z.string().max(40).optional().default(""),
  role: z.enum(["empresa", "sponsor"]),
  empresa: empresaSchema.optional(),
  sponsor: sponsorSchema.optional(),
});

export const publicRegister = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    if (data.role === "empresa" && !data.empresa) {
      throw new Response("Faltan datos de empresa", { status: 400 });
    }
    if (data.role === "sponsor" && !data.sponsor) {
      throw new Response("Faltan datos de sponsor", { status: 400 });
    }
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, role: data.role },
    });
    if (error || !created.user) {
      throw new Response(error?.message ?? "No se pudo crear la cuenta", { status: 400 });
    }
    const userId = created.user.id;
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email: data.email, full_name: data.full_name, phone: data.phone, role: data.role });
    if (data.role === "empresa" && data.empresa) {
      await supabaseAdmin.from("empresa_profiles").upsert({ user_id: userId, ...data.empresa });
    } else if (data.role === "sponsor" && data.sponsor) {
      // sponsorship_level lo asigna el super administrador (default BRONZE)
      await supabaseAdmin.from("sponsor_profiles").upsert({ user_id: userId, ...data.sponsor });
    }
    return { ok: true };
  });
