import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { ClipboardList, MapPin, User, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresa/reuniones-1to1")({
  component: ReunionesEmpresa,
});

function ReunionesEmpresa() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: me } = await supabase.from("profiles").select("account_id").eq("id", user.id).maybeSingle();
      const { data: teamProfiles } = me?.account_id
        ? await supabase.from("profiles").select("id, full_name").eq("account_id", me.account_id)
        : { data: [] as any[] };
      const teamIds = (teamProfiles ?? []).map((p: any) => p.id);
      const teamMap = new Map((teamProfiles ?? []).map((p: any) => [p.id, p]));
      const { data: meetings } = teamIds.length
        ? await supabase.from("meetings_1to1").select("*").in("empresa_user_id", teamIds).order("scheduled_time")
        : { data: [] as any[] };

      const sponsorAccIds = Array.from(new Set((meetings ?? []).map((m: any) => m.sponsor_account_id).filter(Boolean)));
      const { data: sps } = sponsorAccIds.length
        ? await supabase.from("sponsor_profiles").select("id, company_name, logo_url").in("id", sponsorAccIds as string[])
        : { data: [] as any[] };
      const accMap = new Map((sps ?? []).map((s: any) => [s.id, s]));

      setRows((meetings ?? []).map((m: any) => {
        const sp = accMap.get(m.sponsor_account_id);
        const resp = m.sponsor_responsable && typeof m.sponsor_responsable === "object" ? m.sponsor_responsable : null;
        const myProf = teamMap.get(m.empresa_user_id) as any;
        return {
          ...m,
          partner_name: sp?.company_name ?? "Solución",
          partner_logo: sp?.logo_url ?? null,
          responsable: resp?.full_name ?? null,
          responsable_role: resp?.role ?? null,
          my_attendee: myProf?.full_name ?? null,
        };
      }));
    })();
  }, []);

  return <MeetingsList rows={rows} />;
}

export function MeetingsList({ rows }: { rows: any[] }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Mis reuniones 1to1" subtitle="Speed-meetings de 15 minutos asignadas por el organizador" />
      {rows.length === 0 ? <EmptyState icon={ClipboardList} title="Sin reuniones asignadas" hint="El organizador asignará tus 1to1 en base a tus matches" /> : (
        <div className="space-y-3">
          {rows.map((r) => {
            const d = r.scheduled_time ? new Date(r.scheduled_time) : null;
            const time = d ? d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }) : null;
            const date = d ? d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/Madrid" }) : null;
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="h-16 w-16 shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center border border-border">
                  {r.partner_logo ? (
                    <img src={r.partner_logo} alt={r.partner_name} className="h-full w-full object-contain" />
                  ) : (
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base truncate">{r.partner_name}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1">
                    {r.my_attendee && <span className="inline-flex items-center gap-1 text-primary"><User className="h-3 w-3" />Asiste: {r.my_attendee}</span>}
                    {r.responsable && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{r.responsable}{r.responsable_role ? ` · ${r.responsable_role}` : ""}</span>}
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.room ? `Mesa ${r.room}` : "Mesa por asignar"}</span>
                  </div>
                </div>
                <div className="shrink-0 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-center min-w-[110px]">
                  <div className="font-display text-lg font-bold leading-none">{time ?? "—"}</div>
                  <div className="text-[10px] text-uppercase-wide mt-1 opacity-90">{date ?? "Por asignar"}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
