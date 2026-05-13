import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { ClipboardList, MapPin, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sponsor/reuniones-1to1")({
  component: ReunionesSponsor,
});

function ReunionesSponsor() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("meetings_1to1").select("*").eq("sponsor_user_id", user.id).order("scheduled_time");
      setRows(data ?? []);
    })();
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Mis reuniones 1to1" subtitle="Speed-meetings asignadas por el organizador" />
      {rows.length === 0 ? <EmptyState icon={ClipboardList} title="Sin reuniones asignadas" hint="El organizador asignará tus 1to1 en base a tus matches" /> : (
        <div className="space-y-3">{rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-md bg-primary/10 text-primary flex items-center justify-center font-display text-sm font-bold">
              {r.scheduled_time && new Date(r.scheduled_time).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Reunión 1to1</div>
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-1">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.room ?? "Por asignar"}</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{r.duration_minutes ?? 30} min</span>
              </div>
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-uppercase-wide">{r.status}</span>
          </div>
        ))}</div>
      )}
    </div>
  );
}
