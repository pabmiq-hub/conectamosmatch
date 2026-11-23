import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), update: vi.fn(), send: vi.fn(), generate: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./admin-shared.server", () => ({ assertSuperAdmin: mocks.authorize }));
vi.mock("./credentials-email.server", () => ({ generatePassword: mocks.generate, sendEmail: mocks.send, credentialsEmailHtml: (data: { password: string }) => data.password }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { email: "participant@example.com", full_name: "Participante de prueba", role: "empresa" } }) }) }) }),
  auth: { admin: { updateUserById: mocks.update } },
} }));
import { setPasswordAndMaybeSend } from "./credentials-email.functions";

const invoke = setPasswordAndMaybeSend as unknown as (args: {
  data: { userId: string; send: boolean; password?: string }; context: { userId: string };
}) => Promise<{ ok: boolean; credentials?: { user_id: string; password: string; email: string; status: string } }>;
const userId = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue(undefined);
  mocks.update.mockResolvedValue({ error: null });
  mocks.send.mockResolvedValue(undefined);
  mocks.generate.mockReturnValue("Test-generated-42");
});
describe("Credenciales individuales para el Excel", () => {
  it("devuelve sólo las claves del participante enviadas por correo y guardadas en Auth", async () => {
    const result = await invoke({ data: { userId, send: true }, context: { userId: "admin" } });
    expect(result).toMatchObject({ ok: true, credentials: { user_id: userId, password: "Test-generated-42", email: "participant@example.com", status: "Enviado" } });
    expect(mocks.update).toHaveBeenCalledWith(userId, { password: result.credentials?.password });
    expect(mocks.send).toHaveBeenCalledWith("participant@example.com", expect.any(String), result.credentials?.password);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it("conserva la contraseña editada en el correo y en el Excel sin regenerarla", async () => {
    const result = await invoke({ data: { userId, send: true, password: "Test-edited-99" }, context: { userId: "admin" } });
    expect(result.credentials?.password).toBe("Test-edited-99");
    expect(mocks.send).toHaveBeenCalledWith("participant@example.com", expect.any(String), "Test-edited-99");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("no declara enviado ni devuelve credenciales si falla el correo", async () => {
    mocks.send.mockRejectedValue(new Error("No enviado"));
    const result = await invoke({ data: { userId, send: true }, context: { userId: "admin" } });
    expect(result.ok).toBe(false);
    expect(result.credentials).toBeUndefined();
  });
  it("rechaza antes de cambiar claves o devolverlas a quien no es superadministrador", async () => {
    mocks.authorize.mockRejectedValue(new Error("No autorizado"));
    await expect(invoke({ data: { userId, send: true }, context: { userId: "participant" } })).rejects.toThrow("No autorizado");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});