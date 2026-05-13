import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Ticket, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/codigos")({
  component: AdminCodigos,
});

function AdminCodigos() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("invitation_codes").select("*").order("created_at", { ascending: false });
      setRows(data ?? []);
    })();
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Códigos de invitación" subtitle="Códigos generados por sponsors y por la plataforma" />
      {rows.length === 0 ? <EmptyState icon={Ticket} title="Sin códigos" /> : (
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
