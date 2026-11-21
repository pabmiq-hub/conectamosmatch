import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn(), email: vi.fn(), upsert: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./selection-reminder.server", () => ({ loadReminderRecipients: mocks.load, reminderNotificationId: async () => "notification-id" }));
vi.mock("./credentials-email.server", () => ({ sendEmail: mocks.email }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ upsert: mocks.upsert }) } }));
import { sendSelectionReminder } from "./selection-reminder.functions";

const userId = "00000000-0000-4000-8000-000000000001";
const data = { eventId: "00000000-0000-4000-8000-000000000002", role: "sponsor", userId, campaignId: "00000000-0000-4000-8000-000000000003", subject: "Selecciones", body: "{nombre}|{tipo_objetivo}|{fecha}", date: "2026-11-25" };
function context(role: string) {
  return { userId: "admin", supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role }, error: null }) }) }) }) } };
}
const invoke = sendSelectionReminder as unknown as (args: { data: typeof data; context: ReturnType<typeof context> }) => Promise<{ emailSent: boolean; notified: boolean }>;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue([{ id: userId, name: "Montse", email: "montse@example.com", role: "sponsor" }]);
  mocks.email.mockResolvedValue(undefined);
  mocks.upsert.mockResolvedValue({ error: null });
});
describe("Envío autorizado del comunicado", () => {
  it("rechaza participantes antes de leer destinatarios o enviar correos", async () => {
    await expect(invoke({ data, context: context("sponsor") })).rejects.toThrow("Sólo el superadministrador");
    expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.email).not.toHaveBeenCalled();
  });
  it("rechaza destinatarios ajenos al evento y filtro", async () => {
    mocks.load.mockResolvedValue([]);
    await expect(invoke({ data, context: context("super_admin") })).rejects.toThrow("ya no está inscrita");
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("envía la personalización y vincula el aviso a las empresas con idempotencia", async () => {
    expect(await invoke({ data, context: context("super_admin") })).toMatchObject({ emailSent: true, notified: true });
    expect(mocks.email).toHaveBeenCalledWith("montse@example.com", "Selecciones", expect.stringContaining("Montse|empresas|25 de noviembre de 2026"), `${data.campaignId}:${userId}`);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: userId, body: "Montse|empresas|25 de noviembre de 2026", link: "/sponsor/ver-empresas" }), { onConflict: "id", ignoreDuplicates: true });
  });
  it("si falla el email conserva y comunica el resultado del aviso interno", async () => {
    mocks.email.mockRejectedValue(new Error("Proveedor [403]"));
    expect(await invoke({ data, context: context("super_admin") })).toMatchObject({ emailSent: false, notified: true, error: "Proveedor [403]" });
  });
  it("no declara completo el envío si falla el aviso interno", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "Aviso no guardado" } });
    expect(await invoke({ data, context: context("super_admin") })).toMatchObject({ emailSent: true, notified: false });
  });
});