import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";
import { dashboardPathFor } from "@/lib/auth";

type Role = "empresa" | "sponsor";

export const Route = createFileRoute("/registro")({
  validateSearch: (s: Record<string, unknown>) => ({ role: (s.role as Role) || undefined }),
  component: RegistroPage,
});

function RegistroPage() {
  const nav = useNavigate();
  const search = Route.useSearch();
  const [role, setRole] = useState<Role | null>(search.role ?? null);
  const [step, setStep] = useState<1 | 2>(search.role ? 2 : 1);
  const [loading, setLoading] = useState(false);

  // form state
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    company_name: "",
    sector: "",
    company_size: "11-50",
    sponsorship_category: "",
    sponsorship_level: "BRONZE",
    phone: "",
    website: "",
    description: "",
    tagline: "",
    location_city: "",
    linkedin_url: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}${dashboardPathFor(role)}`,
        data: { full_name: form.full_name, role },
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      // Wait briefly for handle_new_user trigger, then upsert role profile row
      await new Promise((r) => setTimeout(r, 300));
      if (role === "empresa") {
        await supabase.from("empresa_profiles").upsert({
          user_id: userId,
          company_name: form.company_name,
          tagline: form.tagline,
          description: form.description,
          sector: form.sector,
          company_size: form.company_size as any,
          website: form.website,
          location_city: form.location_city,
          linkedin_url: form.linkedin_url,
        });
      } else {
        await supabase.from("sponsor_profiles").upsert({
          user_id: userId,
          company_name: form.company_name,
          tagline: form.tagline,
          description: form.description,
          sector: form.sector,
          sponsorship_category: form.sponsorship_category,
          sponsorship_level: form.sponsorship_level as any,
          website: form.website,
          linkedin_url: form.linkedin_url,
        });
      }
      await supabase.from("profiles").update({ phone: form.phone, full_name: form.full_name }).eq("id", userId);
    }

    setLoading(false);
    if (data.session) {
      toast.success("¡Cuenta creada!");
      nav({ to: dashboardPathFor(role) });
    } else {
      toast.success("Revisa tu email para confirmar tu cuenta.");
      nav({ to: "/login" });
    }
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex justify-center mb-8"><Logo /></div>

        {step === 1 && (
          <div className="rounded-xl border border-border bg-card p-8">
            <h1 className="font-display text-2xl font-bold text-uppercase-wide text-center">Únete a Conectamos Match</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">¿Cómo quieres participar?</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {([
                { r: "empresa", icon: Building2, title: "Empresa", desc: "Soy una empresa buscando soluciones SaaS y partners tecnológicos." },
                { r: "sponsor", icon: Sparkles, title: "Sponsor", desc: "Soy un SaaS que quiere conectar con empresas que necesitan mi solución." },
              ] as const).map(({ r, icon: Icon, title, desc }) => (
                <button key={r} type="button"
                  onClick={() => { setRole(r); setStep(2); }}
                  className="text-left rounded-xl border border-border bg-background p-6 card-hover">
                  <Icon className="h-7 w-7 text-primary" />
                  <h3 className="mt-4 font-display text-xl font-bold text-uppercase-wide">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                  <div className="mt-4 flex items-center gap-1 text-xs text-primary text-uppercase-wide font-bold">
                    Continuar <ArrowRight className="h-3 w-3" />
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-8 text-center text-xs text-muted-foreground">
              ¿Ya tienes cuenta? <Link to="/login" className="text-primary font-bold text-uppercase-wide">Inicia sesión</Link>
            </p>
          </div>
        )}

        {step === 2 && role && (
          <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-xl font-bold text-uppercase-wide">
                Registro {role === "empresa" ? "Empresa" : "Sponsor"}
              </h1>
              <button type="button" onClick={() => setStep(1)} className="text-xs text-muted-foreground hover:text-foreground text-uppercase-wide">
                ← Cambiar rol
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Nombre completo" required value={form.full_name} onChange={(v) => set("full_name", v)} />
              <Field label="Email" type="email" required value={form.email} onChange={(v) => set("email", v)} />
              <Field label="Contraseña" type="password" required value={form.password} onChange={(v) => set("password", v)} />
              <Field label="Teléfono" value={form.phone} onChange={(v) => set("phone", v)} />
              <Field label="Nombre de la empresa" required value={form.company_name} onChange={(v) => set("company_name", v)} />
              <Field label="Sector" required value={form.sector} onChange={(v) => set("sector", v)} placeholder="Automotive, Health, Tech…" />
              {role === "empresa" ? (
                <Select label="Tamaño de empresa" value={form.company_size} onChange={(v) => set("company_size", v)}
                  options={["1-10", "11-50", "51-200", "201-500", "500+"]} />
              ) : (
                <>
                  <Field label="Categoría de patrocinio" value={form.sponsorship_category} onChange={(v) => set("sponsorship_category", v)} placeholder="Loyalty, CRM, Pagos…" />
                  <Select label="Nivel de patrocinio" value={form.sponsorship_level} onChange={(v) => set("sponsorship_level", v)}
                    options={["PLATINUM", "GOLD", "SILVER", "BRONZE"]} />
                </>
              )}
              <Field label="Website" value={form.website} onChange={(v) => set("website", v)} placeholder="https://…" />
              <Field label="LinkedIn" value={form.linkedin_url} onChange={(v) => set("linkedin_url", v)} placeholder="https://linkedin.com/company/…" />
              <Field label="Ciudad" value={form.location_city} onChange={(v) => set("location_city", v)} />
              <Field label="Tagline" value={form.tagline} onChange={(v) => set("tagline", v)} placeholder="Frase corta" />
            </div>

            <div>
              <label className="text-xs text-uppercase-wide text-muted-foreground">Descripción</label>
              <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-uppercase-wide">
              {loading ? "Creando cuenta…" : "Crear cuenta"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-uppercase-wide text-muted-foreground">{label}{required && " *"}</label>
      <input type={type} required={required} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-xs text-uppercase-wide text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
