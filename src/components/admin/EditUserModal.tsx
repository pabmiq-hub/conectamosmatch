import { useEffect, useState } from "react";
import { X, Pencil, Wand2, Loader2, Crown, ArrowRightLeft, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getUserForEdit, updateUserProfile, transferAccountAdmin } from "@/lib/admin-users.functions";
import { scrapeProfileFromUrl } from "@/lib/scrape-profile.functions";
import { MoveToAccountModal } from "@/components/admin/MoveToAccountModal";
import { toast } from "sonner";

export function EditUserModal({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved?: () => void }) {
  const fetchUser = useServerFn(getUserForEdit);
  const save = useServerFn(updateUserProfile);
  const scrape = useServerFn(scrapeProfileFromUrl);
  const promote = useServerFn(transferAccountAdmin);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [role, setRole] = useState<"empresa" | "sponsor" | "super_admin">("empresa");
  const [accountRole, setAccountRole] = useState<"owner" | "manager" | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string>("");
  const [hasAccount, setHasAccount] = useState(false);
  const [f, setF] = useState<any>({
    full_name: "", email: "", phone: "", is_active: true,
    company_name: "", sector: "", website: "", linkedin_url: "", tagline: "", description: "",
    location_city: "", company_size: "11-50",
    sponsorship_category: "", sponsorship_level: "BASIC",
  });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    fetchUser({ data: { userId } }).then(({ profile, account }) => {
      setRole(profile.role);
      setHasAccount(!!account);
      setAccountRole((profile.account_role as any) ?? null);
      setAccountId(profile.account_id ?? null);
      setAccountName(account?.company_name ?? "");
      setF({
        full_name: profile.full_name ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        is_active: profile.is_active ?? true,
        company_name: account?.company_name ?? "",
        sector: account?.sector ?? "",
        website: account?.website ?? "",
        linkedin_url: account?.linkedin_url ?? "",
        tagline: account?.tagline ?? "",
        description: account?.description ?? "",
        location_city: account?.location_city ?? "",
        company_size: account?.company_size ?? "11-50",
        sponsorship_category: account?.sponsorship_category ?? "",
        sponsorship_level: account?.sponsorship_level ?? "BASIC",
      });
      setScrapeUrl(account?.website ?? "");
      setLoading(false);
    }).catch((e: any) => { toast.error(e?.message ?? "Error"); onClose(); });
  }, [userId]);

  async function runScrape() {
    if (!scrapeUrl.trim() || role === "super_admin") return;
    setScraping(true);
    try {
      const { data } = await scrape({ data: { url: scrapeUrl, kind: role as "empresa" | "sponsor" } });
      setF((p: any) => ({
        ...p,
        company_name: p.company_name || data.company_name || "",
        sector: p.sector || data.sector || "",
        website: p.website || data.website || "",
        linkedin_url: p.linkedin_url || data.linkedin_url || "",
        location_city: p.location_city || data.location_city || "",
        tagline: p.tagline || data.tagline || "",
        description: p.description || data.description || "",
      }));
      toast.success("Datos autocompletados — revísalos antes de guardar");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo extraer la web");
    } finally { setScraping(false); }
  }

  async function submit() {
    setBusy(true);
    try {
      await save({
        data: {
          userId,
          full_name: f.full_name,
          email: f.email,
          phone: f.phone,
          is_active: !!f.is_active,
          account: hasAccount
            ? role === "empresa"
              ? {
                  company_name: f.company_name, sector: f.sector, website: f.website,
                  linkedin_url: f.linkedin_url, tagline: f.tagline, description: f.description,
                  location_city: f.location_city, company_size: f.company_size,
                }
              : {
                  company_name: f.company_name, sector: f.sector, website: f.website,
                  linkedin_url: f.linkedin_url, tagline: f.tagline, description: f.description,
                  sponsorship_category: f.sponsorship_category, sponsorship_level: f.sponsorship_level,
                }
            : undefined,
        },
      });
      toast.success("Datos actualizados");
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-uppercase-wide flex items-center gap-2">
            <Pencil className="h-5 w-5" /> Editar usuario
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {loading ? <div className="text-sm text-muted-foreground">Cargando…</div> : (
          <div className="space-y-5">
            <section>
              <h3 className="text-[11px] font-bold text-uppercase-wide text-muted-foreground mb-2">Datos personales</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Nombre completo *" value={f.full_name} onChange={(v) => set("full_name", v)} />
                <Field label="Email *" type="email" value={f.email} onChange={(v) => set("email", v)} />
                <Field label="Teléfono" value={f.phone} onChange={(v) => set("phone", v)} />
                <div>
                  <label className="text-xs text-uppercase-wide text-muted-foreground">Estado</label>
                  <select value={f.is_active ? "1" : "0"} onChange={(e) => set("is_active", e.target.value === "1")} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
                    <option value="1">Activo</option><option value="0">Inactivo</option>
                  </select>
                </div>
              </div>
            </section>

            {hasAccount && role !== "super_admin" && (
              <section>
                <h3 className="text-[11px] font-bold text-uppercase-wide text-muted-foreground mb-2">Datos de la cuenta ({role})</h3>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 mb-3">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-uppercase-wide text-primary mb-2">
                    <Wand2 className="h-3.5 w-3.5" /> Autocompletar desde web
                  </div>
                  <div className="flex gap-2">
                    <input value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} placeholder="empresa.com o https://…"
                      className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm" />
                    <button type="button" onClick={runScrape} disabled={scraping || !scrapeUrl.trim()}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
                      {scraping ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Extrayendo…</> : <><Wand2 className="h-3.5 w-3.5" /> Extraer</>}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">Solo rellena campos vacíos. Revisa los datos antes de guardar.</p>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Nombre" value={f.company_name} onChange={(v) => set("company_name", v)} />
                  <Field label="Sector" value={f.sector} onChange={(v) => set("sector", v)} />
                  <Field label="Website" value={f.website} onChange={(v) => set("website", v)} />
                  <Field label="LinkedIn" value={f.linkedin_url} onChange={(v) => set("linkedin_url", v)} />
                  {role === "empresa" ? (
                    <>
                      <Field label="Ciudad" value={f.location_city} onChange={(v) => set("location_city", v)} />
                      <Select label="Tamaño" value={f.company_size} onChange={(v) => set("company_size", v)} options={["1-10", "11-50", "51-200", "201-500", "500+"]} />
                    </>
                  ) : (
                    <>
                      <Field label="Categoría" value={f.sponsorship_category} onChange={(v) => set("sponsorship_category", v)} />
                      <Select label="Nivel" value={f.sponsorship_level} onChange={(v) => set("sponsorship_level", v)} options={["GOLD", "PREMIUM", "BASIC", "STARTUP"]} />
                    </>
                  )}
                  <Field label="Tagline" value={f.tagline} onChange={(v) => set("tagline", v)} />
                </div>
                <div className="mt-3">
                  <label className="text-xs text-uppercase-wide text-muted-foreground">Descripción</label>
                  <textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
                </div>
              </section>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={onClose} className="flex-1 rounded-md border border-border py-2.5 text-sm font-bold text-uppercase-wide">Cancelar</button>
              <button onClick={submit} disabled={busy || !f.full_name || !f.email} className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-uppercase-wide text-muted-foreground">{label}</label>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
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
