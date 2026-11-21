import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { personalizeReminder, reminderHtml } from "./selection-reminder";

const audience = z.object({ eventId: z.string().uuid(), role: z.enum(["all", "empresa", "sponsor"]) });
const message = audience.extend({
  userId: z.string().uuid(), campaignId: z.string().uuid(),
  subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(10000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Fecha no válida"),
});

export const listReminderRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => audience.parse(input))
  .handler(async ({ data, context }) => {
    const { data: caller, error } = await context.supabase.from("profiles").select("role").eq("id", context.userId).maybeSingle();
    if (error || caller?.role !== "super_admin") throw new Error("Sólo el superadministrador puede enviar recordatorios");
    const { loadReminderRecipients } = await import("./selection-reminder.server");
    return loadReminderRecipients(data.eventId, data.role);
  });

export const sendSelectionReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => message.parse(input))
  .handler(async ({ data, context }) => {
    const { data: caller, error } = await context.supabase.from("profiles").select("role").eq("id", context.userId).maybeSingle();
    if (error || caller?.role !== "super_admin") throw new Error("Sólo el superadministrador puede enviar recordatorios");
    const { loadReminderRecipients, reminderNotificationId } = await import("./selection-reminder.server");
    const recipient = (await loadReminderRecipients(data.eventId, data.role)).find(p => p.id === data.userId);
    if (!recipient) throw new Error("La persona ya no está inscrita en este grupo del evento");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmail } = await import("./credentials-email.server");
    const subject = personalizeReminder(data.subject, recipient, data.date);
    const body = personalizeReminder(data.body, recipient, data.date);
    let emailSent = false;
    let notified = false;
    const errors: string[] = [];
    try {
      if (!recipient.email) throw new Error("Participante sin correo electrónico");
      await sendEmail(recipient.email, subject, reminderHtml(body), `${data.campaignId}:${recipient.id}`);
      emailSent = true;
    } catch (e) { errors.push(e instanceof Error ? e.message : "No se pudo enviar el correo"); }
    const { error: notificationError } = await supabaseAdmin.from("notifications").upsert({
      id: await reminderNotificationId(data.campaignId, recipient.id), user_id: recipient.id,
      title: subject, body, type: "selection_reminder",
      link: recipient.role === "empresa" ? "/empresa/ver-sponsors" : "/sponsor/ver-empresas",
    }, { onConflict: "id", ignoreDuplicates: true });
    if (notificationError) errors.push(`Aviso interno: ${notificationError.message}`);
    else notified = true;
    return { id: recipient.id, emailSent, notified, error: errors.join(" · ") };
  });