import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard/EmptyState";
import { LogoUploader } from "@/components/dashboard/LogoUploader";
import { ResponsablesEditor, type Responsable } from "@/components/dashboard/ResponsablesEditor";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresa/mi-ficha")({
  component: MiFichaEmpresa,
});

const SECTORS = ["Tecnología","Banca","Energía","Educación","E-commerce","Inmobiliario","Salud","Transporte","RRHH","Travel Tech","Fintech","Otros"];
const SIZES = ["1-10","11-50","51-200","201-500","500+"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-uppercase-wide font-bold text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

function MiFichaEmpresa() {
  const [form, setForm] = useState<any>({ company_name: "", tagline: "", description: "", sector: "", company_size: "", website: "", logo_url: "", location_city: "", linkedin_url: "", looking_for: "", tags: "", responsables: [] as Responsable[] });
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("empresa_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setForm({ ...data, tags: (data.tags ?? []).join(", "), responsables: (data as any).responsables ?? [] });
    })();
  }, []);

  async function save() {
    if (!userId) return;
    setBusy(true);
    const payload = { ...form, user_id: userId, tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [], responsables: form.responsables ?? [] };
    const { error } = await supabase.from("empresa_profiles").upsert(payload, { onConflict: "user_id" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ficha guardada");
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Mi ficha" subtitle="Datos visibles para soluciones y otras empresas" right={
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
          <Save className="h-3 w-3" /> Guardar
        </button>
      } />
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        {userId && <LogoUploader userId={userId} value={form.logo_url} onChange={(url) => setForm({ ...form, logo_url: url })} />}
        <Field label="Nombre de la empresa"><input className={inputCls} value={form.company_name ?? ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></Field>
        <Field label="Tagline"><input className={inputCls} value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Una frase que defina tu empresa" /></Field>
        <Field label="Descripción"><textarea rows={4} className={inputCls} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Sector"><select className={inputCls} value={form.sector ?? ""} onChange={(e) => setForm({ ...form, sector: e.target.value })}><option value="">Selecciona...</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Tamaño"><select className={inputCls} value={form.company_size ?? ""} onChange={(e) => setForm({ ...form, company_size: e.target.value })}><option value="">Selecciona...</option>{SIZES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Web"><input className={inputCls} value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" /></Field>
          <Field label="LinkedIn"><input className={inputCls} value={form.linkedin_url ?? ""} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} /></Field>
          <Field label="Ciudad"><input className={inputCls} value={form.location_city ?? ""} onChange={(e) => setForm({ ...form, location_city: e.target.value })} /></Field>
        </div>
        <Field label="¿Qué buscas en este evento?"><textarea rows={2} className={inputCls} value={form.looking_for ?? ""} onChange={(e) => setForm({ ...form, looking_for: e.target.value })} /></Field>
        <Field label="Tags (separadas por coma)"><input className={inputCls} value={form.tags ?? ""} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tecnología, b2b, retail" /></Field>
        <ResponsablesEditor value={form.responsables ?? []} onChange={(r) => setForm({ ...form, responsables: r })} />
      </div>
    </div>
  );
}
