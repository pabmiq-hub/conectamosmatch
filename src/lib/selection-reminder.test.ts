import { describe, it, expect } from "vitest";
import { reminderRecipients, personalizeReminder, reminderHtml } from "./selection-reminder";
const rows = [
  { user_id: "e", status: "confirmed", role_at_event: "empresa", attendee_name: "Ana", attendee_email: "ana@example.com" },
  { user_id: "s", status: "confirmed", role_at_event: "sponsor", attendee_name: "Montse", attendee_email: "montse@example.com" },
  { user_id: "x", status: "cancelled", role_at_event: "empresa", attendee_name: "X", attendee_email: "x@example.com" },
];
describe("Destinatarios del recordatorio", () => {
  it("todos incluye ambas categorías sin cancelados ni personas duplicadas", () => expect(reminderRecipients([...rows, ...rows], "all").map(r => r.id)).toEqual(["e", "s"]));
  it("sólo empresas", () => expect(reminderRecipients(rows, "empresa").map(r => r.id)).toEqual(["e"]));
  it("sólo soluciones", () => expect(reminderRecipients(rows, "sponsor").map(r => r.id)).toEqual(["s"]));
  it("empresa recibe nombre, soluciones y fecha seleccionada", () => expect(personalizeReminder("{nombre}|{tipo_objetivo}|{fecha}", { id: "e", name: "Ana", email: "a@example.com", role: "empresa" }, "2026-11-25")).toBe("Ana|soluciones|25 de noviembre de 2026"));
  it("solución recibe empresas como objetivo", () => expect(personalizeReminder("{tipo_objetivo}", { id: "s", name: "Montse", email: "s@example.com", role: "sponsor" }, "2026-11-25")).toBe("empresas"));
  it("el contenido editable no inyecta HTML", () => expect(reminderHtml('<script>alert("x")</script>')).not.toContain("<script>"));
});