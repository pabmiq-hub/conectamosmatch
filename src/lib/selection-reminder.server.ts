import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchAll, getEventScope } from "./event-scope.server";
import { reminderRecipients, type ReminderRole } from "./selection-reminder";
import type { Database } from "@/integrations/supabase/types";

export async function loadReminderRecipients(eventId: string, role: ReminderRole) {
  const { data: event, error } = await supabaseAdmin.from("events").select("id").eq("id", eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!event) throw new Error("Evento no encontrado");
  const [scope, rows] = await Promise.all([
    getEventScope(supabaseAdmin, eventId),
    fetchAll<Database["public"]["Tables"]["event_registrations"]["Row"]>((a, b) => supabaseAdmin.from("event_registrations").select("*").eq("event_id", eventId).order("id").range(a, b)),
  ]);
  const recipients = reminderRecipients(rows.filter(row => row.user_id && scope.userIds.has(row.user_id)), role);
  // Auth profile is the actual login/email identity; registrations may contain stale contact details.
  for (let i = 0; i < recipients.length; i += 200) {
    const chunk = recipients.slice(i, i + 200);
    const { data, error: profileError } = await supabaseAdmin.from("profiles").select("id,email,full_name").in("id", chunk.map(p => p.id));
    if (profileError) throw new Error(profileError.message);
    for (const recipient of chunk) {
      const profile = data?.find(p => p.id === recipient.id);
      recipient.email = profile?.email?.trim() || "";
      recipient.name = profile?.full_name?.trim() || recipient.name;
    }
  }
  return recipients;
}

export async function reminderNotificationId(campaign: string, userId: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${campaign}:${userId}`));
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}