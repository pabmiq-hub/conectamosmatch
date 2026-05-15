import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard/EmptyState";
import { LevelBadge } from "@/components/brand/LevelBadge";
import { LogoUploader } from "@/components/dashboard/LogoUploader";
import { ResponsablesEditor, type Responsable } from "@/components/dashboard/ResponsablesEditor";
import { Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sponsor/mi-ficha")({
  component: MiFichaSponsor,
});

const SECTORS = ["Banca","Tecnología","Energía","Bebidas","Transporte","E-commerce","Telecom","Salud","Otros"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[10px] text-uppercase-wide font-bold text-muted-foreground mb-1.5">{label}</span>{children}</label>;
}
const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

function MiFichaSponsor() {
  const [form, setForm] = useState<any>({ company_name: "", tagline: "", description: "", sector: "", website: "", logo_url: "", location_city: "", linkedin_url: "", target_audience: "", budget_range: "", responsables: [] as Responsable[] });
  const [level, setLevel] = useState("BRONZE");
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("sponsor_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) { setForm({ ...data, responsables: (data as any).responsables ?? [] }); setLevel(data.sponsorship_level ?? "BRONZE"); }
    })();
  }, []);

  async function save() {
    if (!userId) return;
    setBusy(true);
    const payload = { ...form, user_id: userId, responsables: form.responsables ?? [] };
    const { error } = await supabase.from("sponsor_profiles").upsert(payload, { onConflict: "user_id" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ficha guardada");
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Mi ficha" subtitle="Datos visibles para empresas y otros sponsors" right={
        <div className="flex items-center gap-3">
          <LevelBadge level={level} />
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
            <Save className="h-3 w-3" /> Guardar
          </button>
        </div>
      } />
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        {userId && <LogoUploader userId={userId} value={form.logo_url} onChange={(url) => setForm({ ...form, logo_url: url })} />}
        <Field label="Nombre"><input className={inputCls} value={form.company_name ?? ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></Field>
        <Field label="Tagline"><input className={inputCls} value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></Field>
        <Field label="Descripción"><textarea rows={4} className={inputCls} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Sector"><select className={inputCls} value={form.sector ?? ""} onChange={(e) => setForm({ ...form, sector: e.target.value })}><option value="">Selecciona...</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Web"><input className={inputCls} value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
          <Field label="LinkedIn"><input className={inputCls} value={form.linkedin_url ?? ""} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} /></Field>
          <Field label="Ciudad"><input className={inputCls} value={form.location_city ?? ""} onChange={(e) => setForm({ ...form, location_city: e.target.value })} /></Field>
          <Field label="Presupuesto"><input className={inputCls} value={form.budget_range ?? ""} onChange={(e) => setForm({ ...form, budget_range: e.target.value })} placeholder="ej: 10.000-25.000€" /></Field>
        </div>
        <Field label="Audiencia objetivo"><input className={inputCls} value={form.target_audience ?? ""} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} /></Field>

        <ResponsablesEditor value={form.responsables ?? []} onChange={(r) => setForm({ ...form, responsables: r })} />
      </div>
    </div>
  );
}
