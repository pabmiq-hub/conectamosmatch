import { useEffect, useState } from "react";
import { X, Pencil, Wand2, Loader2, Crown, ArrowRightLeft, ShieldCheck, Save, UserPlus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getUserForEdit, updateUserProfile, transferAccountAdmin, resetUserPassword, listAccountMembers, updateAccountMember } from "@/lib/admin-users.functions";
import { scrapeProfileFromUrl } from "@/lib/scrape-profile.functions";
import { MoveToAccountModal } from "@/components/admin/MoveToAccountModal";
import { InviteResponsableModal } from "@/components/admin/InviteResponsableModal";
import { LogoUploader } from "@/components/dashboard/LogoUploader";
import { supabase } from "@/integrations/supabase/client";
import { PRESET_SPONSOR_CATEGORIES } from "@/lib/sponsor-categories";
import { toast } from "sonner";

export function EditUserModal({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved?: () => void }) {
  const fetchUser = useServerFn(getUserForEdit);
  const save = useServerFn(updateUserProfile);
  const scrape = useServerFn(scrapeProfileFromUrl);
  const promote = useServerFn(transferAccountAdmin);
  const resetPwd = useServerFn(resetUserPassword);
  const fetchMembers = useServerFn(listAccountMembers);
  const saveMember = useServerFn(updateAccountMember);
  const [newPassword, setNewPassword] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [memberBusy, setMemberBusy] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
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
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [f, setF] = useState<any>({
    full_name: "", email: "", phone: "", cargo: "", is_active: true,
    company_name: "", sector: "", website: "", linkedin_url: "", tagline: "", description: "",
    location_city: "", company_size: "11-50",
    sponsorship_category: "", sponsorship_level: "BASIC",
    categories: [] as string[],
    logo_url: "",
  });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminUserId(data.user?.id ?? null));
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
        cargo: (profile as any).cargo ?? "",
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
        categories: (account as any)?.categories ?? [],
        logo_url: account?.logo_url ?? "",
      });
      setScrapeUrl(account?.website ?? "");
      setLoading(false);
      if (profile.account_id) {
        loadMembers(profile.account_id);
      }
    }).catch((e: any) => { toast.error(e?.message ?? "Error"); onClose(); });
  }, [userId]);

  async function loadMembers(aid: string) {
    try {
      const { members: list } = await fetchMembers({ data: { accountId: aid } });
      setMembers(list);
    } catch { /* ignore */ }
  }

  function patchMember(id: string, patch: any) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch, _dirty: true } : m)));
  }

  async function saveMemberRow(m: any) {
    setMemberBusy(m.id);
    try {
      await saveMember({ data: { userId: m.id, full_name: m.full_name ?? "", email: m.email ?? "", phone: m.phone ?? "", cargo: m.cargo ?? null } });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, _dirty: false } : x)));
      toast.success("Responsable actualizado");
      onSaved?.();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setMemberBusy(null); }
  }

  async function promoteMember(m: any) {
    if (m.account_role === "owner") return;
    if (!confirm(`¿Hacer admin de "${accountName}" a ${m.full_name || m.email}?`)) return;
    setMemberBusy(m.id);
    try {
      await promote({ data: { newAdminUserId: m.id } });
      toast.success("Admin actualizado");
      if (accountId) await loadMembers(accountId);
      onSaved?.();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setMemberBusy(null); }
  }


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

  async function runPromote() {
    if (!accountId || accountRole === "owner") return;
    if (!confirm(`¿Hacer admin de "${accountName || "esta cuenta"}" a ${f.full_name || f.email}? El admin actual pasará a ser responsable.`)) return;
    setPromoting(true);
    try {
      await promote({ data: { newAdminUserId: userId } });
      setAccountRole("owner");
      toast.success("Usuario promovido a admin de la cuenta");
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al promover");
    } finally { setPromoting(false); }
  }

  async function submit() {
    if (newPassword && newPassword.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          userId,
          full_name: f.full_name,
          email: f.email,
          phone: f.phone,
          cargo: f.cargo || null,
          is_active: !!f.is_active,
          account: hasAccount && accountRole === "owner"
            ? role === "empresa"
              ? {
                  company_name: f.company_name, sector: f.sector, website: f.website,
                  linkedin_url: f.linkedin_url, tagline: f.tagline, description: f.description,
                  location_city: f.location_city, company_size: f.company_size,
                  logo_url: f.logo_url || null,
                }
              : {
                  company_name: f.company_name, sector: f.sector, website: f.website,
                  linkedin_url: f.linkedin_url, tagline: f.tagline, description: f.description,
                  sponsorship_category: f.sponsorship_category, sponsorship_level: f.sponsorship_level,
                  categories: f.categories,
                  logo_url: f.logo_url || null,
                }
            : undefined,
        },
      });
      if (newPassword) {
        await resetPwd({ data: { userId, password: newPassword } });
      }
      toast.success(newPassword ? "Datos y contraseña actualizados" : "Datos actualizados");
      setNewPassword("");
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
                {role !== "super_admin" && (
                  <Field label="Cargo" value={f.cargo} onChange={(v) => set("cargo", v)} />
                )}
                <div>
                  <label className="text-xs text-uppercase-wide text-muted-foreground">Estado</label>
                  <select value={f.is_active ? "1" : "0"} onChange={(e) => set("is_active", e.target.value === "1")} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
                    <option value="1">Activo</option><option value="0">Inactivo</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-uppercase-wide text-muted-foreground">Nueva contraseña (opcional)</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={newPassword}
                      placeholder="Dejar vacío para no cambiarla"
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
                        let p = "";
                        for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
                        setNewPassword(p + "!2");
                      }}
                      className="rounded-md border border-border px-3 text-xs font-bold text-uppercase-wide"
                    >Generar</button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Mínimo 8 caracteres. Se guarda al pulsar "Guardar cambios" y se aplica al iniciar sesión.</p>
                </div>
              </div>
            </section>

            {hasAccount && role !== "super_admin" && (
              <section>
                <h3 className="text-[11px] font-bold text-uppercase-wide text-muted-foreground mb-2">Pertenencia a la cuenta</h3>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    {accountRole === "owner" ? (
                      <><Crown className="h-4 w-4 text-primary" /><span className="font-bold">Admin</span> de <span className="font-bold">{accountName || "esta cuenta"}</span></>
                    ) : (
                      <><ShieldCheck className="h-4 w-4 text-muted-foreground" /><span className="font-bold">Responsable</span> de <span className="font-bold">{accountName || "esta cuenta"}</span></>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {accountRole !== "owner" && (
                      <button type="button" onClick={runPromote} disabled={promoting}
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary text-uppercase-wide hover:bg-primary/20 disabled:opacity-50">
                        {promoting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crown className="h-3.5 w-3.5" />}
                        Hacer admin de esta cuenta
                      </button>
                    )}
                    <button type="button" onClick={() => setMoving(true)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-muted">
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Mover a otra cuenta
                    </button>
                  </div>
                  {accountRole === "owner" && (
                    <p className="text-[10px] text-muted-foreground">Para mover este admin a otra cuenta, primero promueve a otro miembro como admin (o quedará automáticamente promovido el siguiente miembro al mover).</p>
                  )}
                </div>
              </section>
            )}

            {hasAccount && role !== "super_admin" && accountId && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-bold text-uppercase-wide text-muted-foreground">
                    Responsables de la cuenta ({members.length})
                  </h3>
                  <button type="button" onClick={() => setInviting(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-bold text-uppercase-wide hover:bg-muted">
                    <UserPlus className="h-3.5 w-3.5" /> Añadir responsable
                  </button>
                </div>
                <div className="rounded-lg border border-border bg-background overflow-hidden divide-y divide-border">
                  {members.length === 0 && (
                    <div className="px-3 py-4 text-xs text-muted-foreground">Cargando responsables…</div>
                  )}
                  {members.map((m) => (
                    <div key={m.id} className="p-3 space-y-2">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-uppercase-wide">
                        {m.account_role === "owner" ? (
                          <span className="inline-flex items-center gap-1 text-primary"><Crown className="h-3.5 w-3.5" /> Admin de la cuenta</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Responsable</span>
                        )}
                        {m.id === userId && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Editando arriba</span>}
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <Field label="Nombre" value={m.full_name ?? ""} onChange={(v) => patchMember(m.id, { full_name: v })} />
                        <Field label="Email" type="email" value={m.email ?? ""} onChange={(v) => patchMember(m.id, { email: v })} />
                        <Field label="Cargo" value={m.cargo ?? ""} onChange={(v) => patchMember(m.id, { cargo: v })} />
                        <Field label="Teléfono" value={m.phone ?? ""} onChange={(v) => patchMember(m.id, { phone: v })} />
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button type="button" onClick={() => saveMemberRow(m)} disabled={memberBusy === m.id || !m._dirty}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground text-uppercase-wide disabled:opacity-40">
                          {memberBusy === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Guardar
                        </button>
                        {m.account_role !== "owner" && (
                          <button type="button" onClick={() => promoteMember(m)} disabled={memberBusy === m.id}
                            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary text-uppercase-wide hover:bg-primary/20 disabled:opacity-40">
                            <Crown className="h-3.5 w-3.5" /> Hacer admin
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Edita inline el cargo y datos de cualquier responsable. Para cambiar contraseña usa el campo de arriba editando ese usuario individual.</p>
              </section>
            )}





            {hasAccount && role !== "super_admin" && accountRole === "owner" && (
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
                {adminUserId && (
                  <div className="mb-3">
                    <LogoUploader userId={adminUserId} value={f.logo_url} onChange={(url) => set("logo_url", url ?? "")} />
                  </div>
                )}
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
                {role === "sponsor" && (
                  <div className="mt-4">
                    <label className="text-xs text-uppercase-wide text-muted-foreground">Retos que soluciona</label>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {PRESET_SPONSOR_CATEGORIES.map((c) => {
                        const on = (f.categories ?? []).includes(c);
                        return (
                          <button type="button" key={c}
                            onClick={() => set("categories", on ? f.categories.filter((x: string) => x !== c) : [...(f.categories ?? []), c])}
                            className={`rounded-full border px-2.5 py-1 text-[11px] ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                            {c}
                          </button>
                        );
                      })}
                    </div>
                    {(f.categories ?? []).filter((c: string) => !PRESET_SPONSOR_CATEGORIES.includes(c as any)).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(f.categories ?? []).filter((c: string) => !PRESET_SPONSOR_CATEGORIES.includes(c as any)).map((c: string) => (
                          <span key={c} className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
                            {c}
                            <button type="button" onClick={() => set("categories", f.categories.filter((x: string) => x !== c))} className="hover:text-foreground"><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      <input id="cat-other" placeholder="Añadir otro reto…" className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const v = (e.currentTarget.value || "").trim();
                            if (v && !(f.categories ?? []).includes(v)) set("categories", [...(f.categories ?? []), v]);
                            e.currentTarget.value = "";
                          }
                        }} />
                    </div>
                  </div>
                )}
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
      {moving && role !== "super_admin" && (
        <MoveToAccountModal
          userId={userId}
          userLabel={f.full_name || f.email}
          currentRole={role as "empresa" | "sponsor"}
          onClose={() => setMoving(false)}
          onDone={() => { setMoving(false); onSaved?.(); onClose(); }}
        />
      )}
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
