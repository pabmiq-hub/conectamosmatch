import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { ClipboardList, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reuniones")({
  component: AdminReuniones,
});

function AdminReuniones() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("meetings_1to1").select("*").order("scheduled_time", { ascending: true });
      setRows(data ?? []);
    })();
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Reuniones 1to1" subtitle="Asignación y seguimiento de speed-meetings" right={
        <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide" onClick={() => toast.info("Asignar 1to1 desde matches: próximamente")}>
          <Plus className="h-4 w-4" /> Asignar reunión
        </button>
      } />
      {rows.length === 0 ? <EmptyState icon={ClipboardList} title="Sin reuniones agendadas" hint="Asigna 1to1 desde un match aprobado" /> : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] text-uppercase-wide text-muted-foreground">
              <tr><th className="px-4 py-3 text-left">Hora</th><th className="px-4 py-3 text-left">Sala</th><th className="px-4 py-3 text-left">Estado</th><th className="px-4 py-3 text-left">Notas</th></tr>
            </thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono text-xs">{r.scheduled_time && new Date(r.scheduled_time).toLocaleString("es-ES")}</td>
                <td className="px-4 py-3 text-xs">{r.room ?? "—"}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{r.status}</span></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.notes ?? "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
