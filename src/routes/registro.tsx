import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { publicRegister } from "@/lib/public-registration.functions";

export const Route = createFileRoute("/registro")({
  head: () => ({
    meta: [
      { title: "Registro — Conectamos" },
      { name: "description", content: "Crea tu cuenta de empresa o sponsor en la plataforma." },
    ],
  }),
  component: RegistroPage,
});

type Role = "empresa" | "sponsor";

function RegistroPage() {
  const nav = useNavigate();
  const register = useServerFn(publicRegister);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [f, setF] = useState({
    full_name: "",
    email: "",
    password: "",
    password2: "",
    phone: "",
    company_name: "",
    sector: "",
    company_size: "11-50" as "1-10" | "11-50" | "51-200" | "201-500" | "500+",
    sponsorship_category: "",
    website: "",
    linkedin_url: "",
    location_city: "",
    tagline: "",
    description: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!role) return;
    if (f.password !== f.password2) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await register({
        data: {
          full_name: f.full_name,
          email: f.email,
          password: f.password,
          phone: f.phone,
          role,
          empresa: role === "empresa" ? {
            company_name: f.company_name, sector: f.sector, company_size: f.company_size,
            website: f.website, location_city: f.location_city, linkedin_url: f.linkedin_url,
            tagline: f.tagline, description: f.description,
          } : undefined,
          sponsor: role === "sponsor" ? {
            company_name: f.company_name, sector: f.sector,
            sponsorship_category: f.sponsorship_category,
            website: f.website, linkedin_url: f.linkedin_url,
            tagline: f.tagline, description: f.description,
          } : undefined,
        },
      });
      setDone(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al registrarse");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <Logo />
          <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground">Ya tengo cuenta →</Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          {done ? (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-success/10 text-success flex items-center justify-center">
                <Check className="h-6 w-6" />
              </div>
              <h2 className="font-display text-xl font-bold text-uppercase-wide">Cuenta creada</h2>
              <p className="text-sm text-muted-foreground">
                Tu cuenta ha sido creada correctamente. {role === "sponsor" && "El administrador asignará tu nivel de patrocinio."}
              </p>
              <button onClick={() => nav({ to: "/login" })} className="rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide">
                Ir a iniciar sesión
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-display text-lg font-bold text-uppercase-wide">
                    {role ? `Registro · ${role}` : "Crea tu cuenta"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">Paso {step} de 4</p>
                </div>
              </div>

              {step === 1 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {([
                    { r: "empresa" as Role, icon: Building2, t: "Soy una Empresa" },
                    { r: "sponsor" as Role, icon: Sparkles, t: "Soy un Sponsor" },
                  ]).map(({ r, icon: Icon, t }) => (
                    <button key={r} onClick={() => { setRole(r); setStep(2); }}
                      className="text-left rounded-xl border border-border bg-background p-5 hover:border-primary transition">
                      <Icon className="h-6 w-6 text-primary" />
                      <h3 className="mt-3 font-display text-base font-bold text-uppercase-wide">{t}</h3>
                    </button>
                  ))}
                </div>
              ) : step === 2 ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Nombre completo *" value={f.full_name} onChange={(v) => set("full_name", v)} />
                    <Field label="Email *" type="email" value={f.email} onChange={(v) => set("email", v)} />
                    <Field label="Contraseña *" type="password" value={f.password} onChange={(v) => set("password", v)} placeholder="Mínimo 8 caracteres" />
                    <Field label="Repite la contraseña *" type="password" value={f.password2} onChange={(v) => set("password2", v)} />
                    <Field label="Teléfono" value={f.phone} onChange={(v) => set("phone", v)} />
                  </div>
                  <Nav onBack={() => setStep(1)} onNext={() => setStep(3)}
                    disabled={!f.full_name || !f.email || f.password.length < 8 || !f.password2} />
                </div>
              ) : step === 3 ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Nombre de empresa *" value={f.company_name} onChange={(v) => set("company_name", v)} />
                    <Field label="Sector" value={f.sector} onChange={(v) => set("sector", v)} placeholder="Tech, Health, Retail..." />
                    {role === "empresa" ? (
                      <Select label="Tamaño" value={f.company_size} onChange={(v) => set("company_size", v)} options={["1-10","11-50","51-200","201-500","500+"]} />
                    ) : (
                      <Field label="Categoría de patrocinio" value={f.sponsorship_category} onChange={(v) => set("sponsorship_category", v)} />
                    )}
                    <Field label="Website" value={f.website} onChange={(v) => set("website", v)} placeholder="https://…" />
                    <Field label="LinkedIn" value={f.linkedin_url} onChange={(v) => set("linkedin_url", v)} />
                    {role === "empresa" && <Field label="Ciudad" value={f.location_city} onChange={(v) => set("location_city", v)} />}
                    <Field label="Tagline" value={f.tagline} onChange={(v) => set("tagline", v)} />
                  </div>
                  <div>
                    <label className="text-xs text-uppercase-wide text-muted-foreground">Descripción</label>
                    <textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
                  </div>
                  {role === "sponsor" && (
                    <p className="text-[11px] text-muted-foreground italic">
                      El nivel de patrocinio (Platinum, Gold, Silver, Bronze) lo asigna el administrador tras la revisión.
                    </p>
                  )}
                  <Nav onBack={() => setStep(2)} onNext={() => setStep(4)} disabled={!f.company_name} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-background p-4 text-sm space-y-2">
                    <Row k="Rol" v={role!} />
                    <Row k="Nombre" v={f.full_name} />
                    <Row k="Email" v={f.email} />
                    <Row k="Teléfono" v={f.phone || "—"} />
                    <Row k="Empresa" v={f.company_name} />
                    <Row k="Sector" v={f.sector || "—"} />
                    {role === "empresa" && <Row k="Tamaño" v={f.company_size} />}
                    {role === "sponsor" && <Row k="Categoría" v={f.sponsorship_category || "—"} />}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setStep(3)} className="flex-1 rounded-md border border-border py-2.5 text-sm font-bold text-uppercase-wide">Atrás</button>
                    <button onClick={submit} disabled={loading}
                      className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
                      {loading ? "Creando…" : "Crear mi cuenta"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-uppercase-wide text-muted-foreground">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
    </div>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-xs text-uppercase-wide text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function Nav({ onBack, onNext, disabled }: { onBack: () => void; onNext: () => void; disabled?: boolean }) {
  return (
    <div className="flex gap-2 pt-2">
      <button onClick={onBack} className="flex-1 rounded-md border border-border py-2.5 text-sm font-bold text-uppercase-wide">Atrás</button>
      <button onClick={onNext} disabled={disabled} className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">Continuar</button>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground text-xs text-uppercase-wide">{k}</span><span className="font-medium">{v}</span></div>;
}
