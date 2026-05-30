import { useState } from "react";
import { Building2, Sparkles, X, Copy, Check, Wand2, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createUserAccount } from "@/lib/admin-users.functions";
import { scrapeProfileFromUrl } from "@/lib/scrape-profile.functions";
import { toast } from "sonner";

type Role = "empresa" | "sponsor";

export function NewUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const create = useServerFn(createUserAccount);
  const scrape = useServerFn(scrapeProfileFromUrl);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [f, setF] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    company_name: "",
    sector: "",
    company_size: "11-50" as "1-10" | "11-50" | "51-200" | "201-500" | "500+",
    sponsorship_category: "",
    sponsorship_level: "BASIC" as "GOLD" | "PREMIUM" | "BASIC" | "STARTUP",
    website: "",
    linkedin_url: "",
    location_city: "",
    tagline: "",
    description: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function genPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    set("password", p + "!2");
  }

  async function submit() {
    if (!role) return;
    setLoading(true);
    try {
      await create({
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
            sponsorship_category: f.sponsorship_category, sponsorship_level: f.sponsorship_level,
            website: f.website, linkedin_url: f.linkedin_url,
            tagline: f.tagline, description: f.description,
          } : undefined,
        },
      });
      setCreated({ email: f.email, password: f.password });
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al crear el usuario");
    } finally {
      setLoading(false);
    }
  }

  function copyCreds() {
    if (!created) return;
    navigator.clipboard.writeText(`Email: ${created.email}\nContraseña: ${created.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-lg font-bold text-uppercase-wide">
              {created ? "Cuenta creada" : `Nuevo usuario${role ? ` · ${role}` : ""}`}
            </h2>
            {!created && <p className="text-xs text-muted-foreground mt-1">Paso {step} de 4 · esta persona será <span className="font-bold text-primary">owner</span> de la cuenta. Para añadir más responsables usa "Invitar responsable".</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {created ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-success/30 bg-success/5 p-4">
              <p className="text-sm font-bold mb-3">Comparte estas credenciales con el usuario por tu canal:</p>
              <div className="rounded-md bg-background p-3 font-mono text-xs space-y-1">
                <div><span className="text-muted-foreground">Email:</span> {created.email}</div>
                <div><span className="text-muted-foreground">Contraseña:</span> {created.password}</div>
              </div>
              <button onClick={copyCreds} className="mt-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-bold text-uppercase-wide">
                {copied ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar credenciales</>}
              </button>
            </div>
            <button onClick={onClose} className="w-full rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide">Cerrar</button>
          </div>
        ) : step === 1 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {([
              { r: "empresa" as Role, icon: Building2, t: "Empresa" },
              { r: "sponsor" as Role, icon: Sparkles, t: "Solución" },
            ]).map(({ r, icon: Icon, t }) => (
              <button key={r} onClick={() => { setRole(r); setStep(2); }} className="text-left rounded-xl border border-border bg-background p-5 hover:border-primary transition">
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
              <div>
                <label className="text-xs text-uppercase-wide text-muted-foreground">Contraseña inicial *</label>
                <div className="flex gap-2 mt-1">
                  <input value={f.password} onChange={(e) => set("password", e.target.value)} className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm" />
                  <button type="button" onClick={genPassword} className="rounded-md border border-border px-3 text-xs font-bold text-uppercase-wide">Generar</button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Mínimo 8 caracteres. La compartirás manualmente.</p>
              </div>
              <Field label="Teléfono" value={f.phone} onChange={(v) => set("phone", v)} />
            </div>
            <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} disabled={!f.full_name || !f.email || f.password.length < 8} />
          </div>
        ) : step === 3 ? (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Nombre de empresa *" value={f.company_name} onChange={(v) => set("company_name", v)} />
              <Field label="Sector" value={f.sector} onChange={(v) => set("sector", v)} placeholder="Tech, Health, Retail..." />
              {role === "empresa" ? (
                <Select label="Tamaño" value={f.company_size} onChange={(v) => set("company_size", v)} options={["1-10","11-50","51-200","201-500","500+"]} />
              ) : (
                <>
                  <Field label="Categoría de patrocinio" value={f.sponsorship_category} onChange={(v) => set("sponsorship_category", v)} />
                  <Select label="Nivel *" value={f.sponsorship_level} onChange={(v) => set("sponsorship_level", v)} options={["GOLD","PREMIUM","BASIC","STARTUP"]} />
                </>
              )}
              <Field label="Website" value={f.website} onChange={(v) => set("website", v)} placeholder="https://…" />
              <Field label="LinkedIn" value={f.linkedin_url} onChange={(v) => set("linkedin_url", v)} />
              {role === "empresa" && <Field label="Ciudad" value={f.location_city} onChange={(v) => set("location_city", v)} />}
              <Field label="Tagline" value={f.tagline} onChange={(v) => set("tagline", v)} />
            </div>
            <div>
              <label className="text-xs text-uppercase-wide text-muted-foreground">Descripción</label>
              <textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
            </div>
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
              {role === "sponsor" && <Row k="Nivel" v={f.sponsorship_level} />}
              {role === "empresa" && <Row k="Tamaño" v={f.company_size} />}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="flex-1 rounded-md border border-border py-2.5 text-sm font-bold text-uppercase-wide">Atrás</button>
              <button onClick={submit} disabled={loading} className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
                {loading ? "Creando…" : "Crear cuenta"}
              </button>
            </div>
          </div>
        )}
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
