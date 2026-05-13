import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Ticket, Plus, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sponsor/mis-codigos")({
  component: MisCodigos,
});

function MisCodigos() {
  const [me, setMe] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [maxUses, setMaxUses] = useState(10);
  const [busy, setBusy] = useState(false);

  async function load(uid: string) {
    const { data } = await supabase.from("invitation_codes").select("*").eq("sponsor_user_id", uid).order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMe(user.id);
      const { data: ev } = await supabase.from("events").select("id").in("status", ["published","ongoing"]).order("event_date").limit(1).maybeSingle();
      setEventId(ev?.id ?? null);
      load(user.id);
    })();
  }, []);

  async function create() {
    if (!me || !code.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("invitation_codes").insert({ sponsor_user_id: me, event_id: eventId, code: code.trim().toUpperCase(), max_uses: maxUses, description: "Código personal" });
    setBusy(false);
    if (error) return toast.error(error.message);
    setCode(""); toast.success("Código creado"); load(me);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mis códigos" subtitle="Genera códigos de invitación para tus contactos" />
      <div className="rounded-xl border border-border bg-card p-5 grid gap-3 md:grid-cols-[1fr_120px_auto]">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MI-CODIGO-2026" className="rounded-md border border-border bg-background px-3 py-2 text-sm font-mono" />
        <input type="number" value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} placeholder="Máx usos" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={create} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
          <Plus className="h-3 w-3" /> Crear código
        </button>
      </div>
      {rows.length === 0 ? <EmptyState icon={Ticket} title="Aún no has creado códigos" /> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="font-mono font-bold text-base">{c.code}</div>
                <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copiado"); }} className="text-muted-foreground hover:text-primary"><Copy className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{c.description}</div>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span>Usos: <strong>{c.times_used}/{c.max_uses ?? "∞"}</strong></span>
                <span className={c.is_active ? "text-success" : "text-muted-foreground"}>{c.is_active ? "Activo" : "Inactivo"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
