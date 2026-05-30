import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { ClipboardList, MapPin, Clock, User, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sponsor/reuniones-1to1")({
  component: ReunionesSponsor,
});

function ReunionesSponsor() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: meetings } = await supabase
        .from("meetings_1to1")
        .select("*")
        .eq("sponsor_user_id", user.id)
        .order("scheduled_time");
      const ids = Array.from(new Set((meetings ?? []).map((m: any) => m.empresa_user_id).filter(Boolean)));
      const { data: emps } = ids.length
        ? await supabase.from("empresa_profiles").select("user_id, company_name, responsables").in("user_id", ids)
        : { data: [] as any[] };
      const map = new Map((emps ?? []).map((e: any) => [e.user_id, e]));
      setRows((meetings ?? []).map((m: any) => {
        const e = map.get(m.empresa_user_id);
        const resp = Array.isArray(e?.responsables) ? e.responsables[0] : null;
        return { ...m, partner_name: e?.company_name ?? "Empresa", responsable: resp?.full_name ?? null, responsable_role: resp?.role ?? null };
      }));
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Mis reuniones 1to1" subtitle="Speed-meetings de 15 minutos asignadas por el organizador" />
      {rows.length === 0 ? <EmptyState icon={ClipboardList} title="Sin reuniones asignadas" hint="El organizador asignará tus 1to1 en base a tus matches" /> : (
        <div className="space-y-3">
          {rows.map((r) => {
            const d = r.scheduled_time ? new Date(r.scheduled_time) : null;
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="h-14 w-14 shrink-0 rounded-md bg-primary/10 text-primary flex flex-col items-center justify-center">
                  <span className="font-display text-sm font-bold leading-tight">{d ? d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                  <span className="text-[9px] text-uppercase-wide">{d ? d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "Por asignar"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{r.partner_name}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1">
                    {r.responsable && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{r.responsable}{r.responsable_role ? ` · ${r.responsable_role}` : ""}</span>}
                    {d && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" })}</span>}
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{r.duration_minutes ?? 15} min</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.room ? `Mesa ${r.room}` : "Mesa por asignar"}</span>
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-uppercase-wide self-start sm:self-center">{r.status}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
