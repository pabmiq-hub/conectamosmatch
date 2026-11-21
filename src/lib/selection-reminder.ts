export type ReminderRole = "all" | "empresa" | "sponsor";
export type ReminderRecipient = { id: string; name: string; email: string; role: "empresa" | "sponsor" };
export const DEFAULT_REMINDER_SUBJECT = "Recordatorio: realiza tus selecciones para Conectamos Match";
export const DEFAULT_REMINDER_BODY = "Hola {nombre},\n\nRecuerda marcar tus selecciones de {tipo_objetivo} antes de {fecha}. Si ya lo has hecho, te recomendamos que revises tus selecciones por si quieres añadir o modificar tus intereses.\n\nUn abrazo,\nMiquel Martí\nConectamos Club";

export function reminderRecipients(rows: { user_id: string | null; status: string | null; role_at_event: string | null; attendee_name: string | null; attendee_email: string | null }[], role: ReminderRole): ReminderRecipient[] {
  const people = new Map<string, ReminderRecipient>();
  for (const row of rows) {
    if (!row.user_id || row.status === "cancelled" || (row.role_at_event !== "empresa" && row.role_at_event !== "sponsor") || (role !== "all" && row.role_at_event !== role)) continue;
    people.set(row.user_id, { id: row.user_id, name: row.attendee_name?.trim() || "participante", email: row.attendee_email?.trim() || "", role: row.role_at_event === "empresa" ? "empresa" : "sponsor" });
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function reminderDateLabel(date: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function personalizeReminder(template: string, recipient: ReminderRecipient, date: string): string {
  const values: Record<string, string> = { nombre: recipient.name, tipo_objetivo: recipient.role === "empresa" ? "soluciones" : "empresas", fecha: reminderDateLabel(date) };
  return template.replace(/\{(nombre|tipo_objetivo|fecha)\}/g, (token, key: string) => values[key] ?? token);
}

export function reminderHtml(message: string): string {
  const escaped = message.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
  return `<!doctype html><html lang="es"><body><h2>Conectamos Club</h2><div style="white-space:pre-wrap;font-family:Arial,sans-serif;line-height:1.6">${escaped}</div><p><a href="https://conectamosmatch.com/login">Entrar en Conectamos Match</a></p></body></html>`;
}