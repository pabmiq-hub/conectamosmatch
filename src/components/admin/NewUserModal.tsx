import { useState } from "react";
import { Building2, Sparkles, X, Copy, Check, UserCog } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createUserAccount } from "@/lib/admin-users.functions";
import { PRESET_SPONSOR_CATEGORIES } from "@/lib/sponsor-categories";
import { toast } from "sonner";

type Role = "empresa" | "sponsor";
type Step = 1 | 2 | 3 | 4;

export function NewUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const create = useServerFn(createUserAccount);
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Company data (step 2)
  const [c, setC] = useState({
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
  const setC1 = (k: keyof typeof c, v: string) => setC((p) => ({ ...p, [k]: v }));

  // Responsable / owner data (step 3) — all required
  const [o, setO] = useState({ full_name: "", cargo: "", email: "", phone: "", password: "" });
  const setO1 = (k: keyof typeof o, v: string) => setO((p) => ({ ...p, [k]: v }));

  function genPwd() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setO1("password", p + "!2");
  }

  async function submit() {
    if (!role) return;
    setLoading(true);
    try {
      await create({
        data: {
          full_name: o.full_name,
          email: o.email,
          password: o.password,
          phone: o.phone,
          cargo: o.cargo,
          role,
          empresa: role === "empresa" ? {
            company_name: c.company_name, sector: c.sector, company_size: c.company_size,
            website: c.website, location_city: c.location_city, linkedin_url: c.linkedin_url,
            tagline: c.tagline, description: c.description,
          } : undefined,
          sponsor: role === "sponsor" ? {
            company_name: c.company_name, sector: c.sector,
            sponsorship_category: c.sponsorship_category, sponsorship_level: c.sponsorship_level,
            website: c.website, linkedin_url: c.linkedin_url,
            tagline: c.tagline, description: c.description,
          } : undefined,
        },
      });
      setCreated({ email: o.email, password: o.password });
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al crear la cuenta");
    } finally { setLoading(false); }
  }

  function copyCreds() {
    if (!created) return;
    navigator.clipboard.writeText(`Email: ${created.email}\nContraseña: ${created.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const companyValid = role === "empresa"
    ? !!c.company_name
    : !!c.company_name && !!c.sponsorship_category;
  const ownerValid =
    !!o.full_name && !!o.cargo && /\S+@\S+\.\S+/.test(o.email) && !!o.phone && o.password.length >= 8;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-lg font-bold text-uppercase-wide">
              {created ? "Cuenta creada" : `Nueva cuenta${role ? ` · ${role === "empresa" ? "Empresa" : "Solución"}` : ""}`}
            </h2>
            {!created && <p className="text-xs text-muted-foreground mt-1">Paso {step} de 4</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {created ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-success/30 bg-success/5 p-4">
              <p className="text-sm font-bold mb-3">Comparte estas credenciales con el responsable por tu canal:</p>
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
              <Field label="Nombre de la empresa *" value={c.company_name} onChange={(v) => setC1("company_name", v)} />
              <Field label="Sector" value={c.sector} onChange={(v) => setC1("sector", v)} placeholder="Tech, Health, Retail…" />
              {role === "empresa" ? (
                <>
                  <Select label="Tamaño" value={c.company_size} onChange={(v) => setC1("company_size", v)} options={["1-10","11-50","51-200","201-500","500+"]} />
                  <Field label="Website" value={c.website} onChange={(v) => setC1("website", v)} placeholder="https://…" />
                  <Field label="LinkedIn" value={c.linkedin_url} onChange={(v) => setC1("linkedin_url", v)} />
                  <Field label="Ciudad" value={c.location_city} onChange={(v) => setC1("location_city", v)} />
                  <div className="md:col-span-2">
                    <Field label="Tagline" value={c.tagline} onChange={(v) => setC1("tagline", v)} />
                  </div>
                </>
              ) : (
                <>
                  <div className="md:col-span-2">
                    <label className="text-xs text-uppercase-wide text-muted-foreground">Retos que soluciona * (selección múltiple)</label>
                    <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5 rounded-md border border-border bg-input p-3 max-h-64 overflow-y-auto">
                      {PRESET_SPONSOR_CATEGORIES.map((opt) => {
                        const selected = c.sponsorship_category.split(",").map((s) => s.trim()).filter(Boolean);
                        const checked = selected.includes(opt);
                        return (
                          <label key={opt} className="flex items-start gap-2 text-sm cursor-pointer hover:text-primary">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...selected, opt]
                                  : selected.filter((s) => s !== opt);
                                setC1("sponsorship_category", next.join(", "));
                              }}
                              className="mt-0.5"
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-2">
                      <label className="text-[11px] text-uppercase-wide text-muted-foreground">Otros (personalizado, separar por comas)</label>
                      <input
                        type="text"
                        placeholder="Otro reto 1, Otro reto 2…"
                        value={(() => {
                          const sel = c.sponsorship_category.split(",").map((s) => s.trim()).filter(Boolean);
                          return sel.filter((s) => !PRESET_SPONSOR_CATEGORIES.includes(s as any)).join(", ");
                        })()}
                        onChange={(e) => {
                          const sel = c.sponsorship_category.split(",").map((s) => s.trim()).filter(Boolean);
                          const preset = sel.filter((s) => PRESET_SPONSOR_CATEGORIES.includes(s as any));
                          const custom = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                          setC1("sponsorship_category", [...preset, ...custom].join(", "));
                        }}
                        className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <Select label="Nivel *" value={c.sponsorship_level} onChange={(v) => setC1("sponsorship_level", v)} options={["GOLD","PREMIUM","BASIC","STARTUP"]} />
                  <Field label="Website" value={c.website} onChange={(v) => setC1("website", v)} placeholder="https://…" />
                  <Field label="LinkedIn" value={c.linkedin_url} onChange={(v) => setC1("linkedin_url", v)} />
                  <div className="md:col-span-2">
                    <Field label="Tagline" value={c.tagline} onChange={(v) => setC1("tagline", v)} />
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="text-xs text-uppercase-wide text-muted-foreground">Descripción</label>
              <textarea rows={3} value={c.description} onChange={(e) => setC1("description", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
            </div>
            <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} disabled={!companyValid} />
          </div>
        ) : step === 3 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-uppercase-wide text-primary">
                <UserCog className="h-3.5 w-3.5" /> Responsable de la cuenta (owner)
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Será el administrador de la cuenta y podrá solicitar nuevos responsables a los super administradores. Todos los datos son obligatorios.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Nombre completo *" value={o.full_name} onChange={(v) => setO1("full_name", v)} />
              <Field label="Cargo *" value={o.cargo} onChange={(v) => setO1("cargo", v)} placeholder="Director RRHH, CEO…" />
              <Field label="Email *" type="email" value={o.email} onChange={(v) => setO1("email", v)} />
              <Field label="Teléfono *" value={o.phone} onChange={(v) => setO1("phone", v)} />
              <div className="md:col-span-2">
                <label className="text-xs text-uppercase-wide text-muted-foreground">Contraseña inicial *</label>
                <div className="flex gap-2 mt-1">
                  <input value={o.password} onChange={(e) => setO1("password", e.target.value)} className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm" />
                  <button type="button" onClick={genPwd} className="rounded-md border border-border px-3 text-xs font-bold text-uppercase-wide">Generar</button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Mínimo 8 caracteres. La compartirás manualmente.</p>
              </div>
            </div>
            <Nav onBack={() => setStep(2)} onNext={() => setStep(4)} disabled={!ownerValid} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background p-4 text-sm space-y-2">
              <Row k="Tipo de cuenta" v={role === "empresa" ? "Empresa" : "Solución"} />
              <Row k="Empresa" v={c.company_name} />
              <Row k="Sector" v={c.sector || "—"} />
              {role === "empresa" && <Row k="Tamaño" v={c.company_size} />}
              {role === "sponsor" && <Row k="Reto que soluciona" v={c.sponsorship_category} />}
              {role === "sponsor" && <Row k="Nivel" v={c.sponsorship_level} />}
              <Row k="Website" v={c.website || "—"} />
              <Row k="LinkedIn" v={c.linkedin_url || "—"} />
              {role === "empresa" && <Row k="Ciudad" v={c.location_city || "—"} />}
              <Row k="Tagline" v={c.tagline || "—"} />
              <div className="border-t border-border pt-2 mt-2">
                <Row k="Responsable" v={`${o.full_name} · ${o.cargo}`} />
                <Row k="Email" v={o.email} />
                <Row k="Teléfono" v={o.phone} />
              </div>
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
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground text-xs text-uppercase-wide">{k}</span><span className="font-medium text-right">{v}</span></div>;
}
