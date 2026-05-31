import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dashboard/EmptyState";
import { LevelBadge } from "@/components/brand/LevelBadge";
import { LogoUploader } from "@/components/dashboard/LogoUploader";
import { ResponsablesEditor, type Responsable } from "@/components/dashboard/ResponsablesEditor";
import { Save, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sponsor/mi-ficha")({
  component: MiFichaSponsor,
});

const PRESET_CATEGORIES = [
  "Desarrollo talento y liderazgo",
  "Uso IA en procesos de RRHH",
  "Reclutamiento talento",
  "Formación",
  "Coaching / mentoring talento",
  "Comunicación interna",
  "Beneficios Empleados",
  "Gestión talento remoto",
  "Nóminas y laboral",
  "Control horario / accesos",
  "Evaluación y mejora del clima laboral / compromiso / employee experience",
  "Cultura",
  "Soluciones de conciliación",
  "Reducción de absentismo",
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[10px] text-uppercase-wide font-bold text-muted-foreground mb-1.5">{label}</span>{children}</label>;
}
const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

function MiFichaSponsor() {
  const [form, setForm] = useState<any>({ id: null, company_name: "", tagline: "", description: "", website: "", logo_url: "", linkedin_url: "", categories: [] as string[], responsables: [] as Responsable[] });
  const [level, setLevel] = useState("BASIC");
  const [userId, setUserId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customDraft, setCustomDraft] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: prof } = await supabase.from("profiles").select("account_id").eq("id", user.id).maybeSingle();
      const accId = prof?.account_id ?? null;
      setAccountId(accId);
      const query = accId
        ? supabase.from("sponsor_profiles").select("*").eq("id", accId).maybeSingle()
        : supabase.from("sponsor_profiles").select("*").eq("user_id", user.id).maybeSingle();
      const { data } = await query;
      if (data) {
        setForm({
          id: (data as any).id ?? null,
          company_name: data.company_name ?? "",
          tagline: data.tagline ?? "",
          description: data.description ?? "",
          website: data.website ?? "",
          logo_url: data.logo_url ?? "",
          linkedin_url: data.linkedin_url ?? "",
          categories: (data as any).categories ?? [],
          responsables: (data as any).responsables ?? [],
        });
        setLevel(data.sponsorship_level ?? "BASIC");
      }
    })();
  }, []);

  const presetSelected = (c: string) => form.categories.includes(c);
  const customCategories: string[] = (form.categories ?? []).filter((c: string) => !PRESET_CATEGORIES.includes(c));

  function togglePreset(c: string) {
    const next = presetSelected(c)
      ? form.categories.filter((x: string) => x !== c)
      : [...form.categories, c];
    setForm({ ...form, categories: next });
  }
  function addCustom() {
    const v = customDraft.trim();
    if (!v) return;
    if (form.categories.includes(v)) { setCustomDraft(""); return; }
    setForm({ ...form, categories: [...form.categories, v] });
    setCustomDraft("");
  }
  function removeCustom(c: string) {
    setForm({ ...form, categories: form.categories.filter((x: string) => x !== c) });
  }

  async function save() {
    if (!userId) return;
    setBusy(true);
    const baseFields = {
      company_name: form.company_name,
      tagline: form.tagline,
      description: form.description,
      website: form.website,
      logo_url: form.logo_url,
      linkedin_url: form.linkedin_url,
      categories: form.categories,
      responsables: form.responsables ?? [],
    };
    let error;
    if (form.id) {
      ({ error } = await supabase.from("sponsor_profiles").update(baseFields).eq("id", form.id));
    } else {
      ({ error } = await supabase.from("sponsor_profiles").insert({ ...baseFields, user_id: userId }));
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ficha guardada");
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Mi ficha" subtitle="Datos visibles para empresas y otras soluciones" right={
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
          <Field label="Web"><input className={inputCls} value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
          <Field label="LinkedIn"><input className={inputCls} value={form.linkedin_url ?? ""} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} /></Field>
        </div>

        <div>
          <span className="block text-[10px] text-uppercase-wide font-bold text-muted-foreground mb-2">Categorías de tu solución (selección múltiple)</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRESET_CATEGORIES.map((c) => (
              <label key={c} className="flex items-start gap-2 rounded-md border border-border bg-background p-2.5 text-sm cursor-pointer hover:bg-muted/40">
                <input type="checkbox" checked={presetSelected(c)} onChange={() => togglePreset(c)} className="mt-0.5" />
                <span>{c}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <span className="block text-[10px] text-uppercase-wide font-bold text-muted-foreground">Otras categorías personalizadas</span>
            {customCategories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customCategories.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs">
                    {c}
                    <button type="button" onClick={() => removeCustom(c)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="Añadir otra categoría…"
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
              />
              <button type="button" onClick={addCustom} className="inline-flex items-center gap-1 rounded-md border border-border px-3 text-xs font-bold text-uppercase-wide hover:bg-muted">
                <Plus className="h-3 w-3" /> Añadir
              </button>
            </div>
          </div>
        </div>

        <ResponsablesEditor value={form.responsables ?? []} onChange={(r) => setForm({ ...form, responsables: r })} />
      </div>
    </div>
  );
}
