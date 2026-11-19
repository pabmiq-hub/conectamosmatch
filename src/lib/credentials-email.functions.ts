import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSuperAdmin } from "./admin-shared.server";
import { credentialsEmailHtml, generatePassword, sendEmail } from "./credentials-email.server";

const LOGIN_URL = "https://conectamosmatch.com/login";

async function processOne(userId: string, eventTitle: string | null, password: string | undefined, send: boolean) {
  const { data: prof } = await supabaseAdmin.from("profiles").select("id, email, full_name, role").eq("id", userId).maybeSingle();
  if (!prof?.email) throw new Error("Usuario sin email");
  if (prof.role === "super_admin") throw new Error("No se modifican super administradores");
  const pwd = password ?? generatePassword(12);
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: pwd });
  if (error) throw new Error(error.message);
  if (send) {
    await sendEmail(prof.email, eventTitle ? `Tus claves de acceso · ${eventTitle}` : "Tus claves de acceso a Conectamos",
      credentialsEmailHtml({ name: prof.full_name ?? "", email: prof.email, password: pwd, eventTitle, loginUrl: LOGIN_URL }));
  }
  return { email: prof.email as string, name: (prof.full_name ?? "") as string };
}

async function eventTitle(eventId?: string | null) {
  if (!eventId) return null;
  const { data } = await supabaseAdmin.from("events").select("title").eq("id", eventId).maybeSingle();
  return data?.title ?? null;
}

/** Sets a password (given or generated) for one user and optionally emails it. */
export const setPasswordAndMaybeSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    userId: z.string().uuid(),
    password: z.string().min(8).max(100).optional(),
    send: z.boolean(),
    event_id: z.string().uuid().optional().nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    try {
      const r = await processOne(data.userId, await eventTitle(data.event_id), data.password, data.send);
      return { ok: true as const, email: r.email };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? "Error" };
    }
  });

/** Generates new passwords for all event participants (or a subset) and emails them. */
export const sendEventCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    event_id: z.string().uuid(),
    userIds: z.array(z.string().uuid()).max(500).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const title = await eventTitle(data.event_id);
    const { data: regs } = await supabaseAdmin.from("event_registrations").select("user_id, status").eq("event_id", data.event_id);
    let ids = Array.from(new Set((regs ?? []).filter((r: any) => r.user_id && r.status !== "cancelled").map((r: any) => r.user_id as string)));
    if (data.userIds) { const only = new Set(data.userIds); ids = ids.filter((i) => only.has(i)); }
    const sent: string[] = [];
    const failed: { email: string; error: string }[] = [];
    // One row per participant with the exact password stored in Auth, so the admin's Excel always matches the emails.
    const results: { user_id: string; email: string; name: string; password: string | null; status: string; sent_at: string }[] = [];
    for (const id of ids) {
      const pwd = generatePassword(12);
      let email = id; let name = ""; let pwdSaved = false;
      try {
        const { data: prof } = await supabaseAdmin.from("profiles").select("id, email, full_name, role").eq("id", id).maybeSingle();
        if (!prof?.email) throw new Error("Usuario sin email");
        email = prof.email; name = prof.full_name ?? "";
        if (prof.role === "super_admin") throw new Error("No se modifican super administradores");
        const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: pwd });
        if (error) throw new Error(error.message);
        pwdSaved = true;
        await sendEmail(prof.email, title ? `Tus claves de acceso · ${title}` : "Tus claves de acceso a Conectamos",
          credentialsEmailHtml({ name, email: prof.email, password: pwd, eventTitle: title, loginUrl: LOGIN_URL }));
        sent.push(email);
        results.push({ user_id: id, email, name, password: pwd, status: "Enviado", sent_at: new Date().toISOString() });
      } catch (e: any) {
        const msg = e?.message ?? "Error";
        failed.push({ email, error: msg });
        // If the password was already changed, keep it in the Excel so the admin can hand it over manually.
        results.push({ user_id: id, email, name, password: pwdSaved ? pwd : null, status: `Error: ${msg}`, sent_at: new Date().toISOString() });
      }
      await new Promise((r) => setTimeout(r, 250)); // stay under Resend rate limits
    }
    return { total: ids.length, sent: sent.length, failed, results };
  });
