import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { ClipboardList, MapPin, Clock, User, Calendar } from "lucide-react";

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
        ? await supabase.from("profiles").select("id, full_name, account_role").eq("account_id", me.account_id)
        : { data: [] as any[] };
      const teamIds = (teamProfiles ?? []).map((p: any) => p.id);
      const teamMap = new Map((teamProfiles ?? []).map((p: any) => [p.id, p]));
      const { data: meetings } = teamIds.length
        ? await supabase.from("meetings_1to1").select("*").in("empresa_user_id", teamIds).order("scheduled_time")
        : { data: [] as any[] };
      const sponsorIds = Array.from(new Set((meetings ?? []).map((m: any) => m.sponsor_user_id).filter(Boolean)));
      const sponsorAccIds = Array.from(new Set((meetings ?? []).map((m: any) => m.sponsor_account_id).filter(Boolean)));
      const { data: sponsorProfs } = sponsorIds.length
        ? await supabase.from("profiles").select("id, account_id").in("id", sponsorIds)
        : { data: [] as any[] };
      const sponsorProfAcc = new Map((sponsorProfs ?? []).map((p: any) => [p.id, p.account_id]));
      const allSpAcc = Array.from(new Set([...sponsorAccIds, ...Array.from(sponsorProfAcc.values())].filter(Boolean)));
      const { data: spOwnersAll } = allSpAcc.length
        ? await supabase.from("profiles").select("id, account_id").eq("account_role", "owner").in("account_id", allSpAcc as string[])
        : { data: [] as any[] };
      const accToOwner = new Map((spOwnersAll ?? []).map((p: any) => [p.account_id, p.id]));
      const ownerIds = Array.from(new Set((spOwnersAll ?? []).map((p: any) => p.id)));
      const { data: sps } = ownerIds.length
        ? await supabase.from("sponsor_profiles").select("user_id, company_name").in("user_id", ownerIds)
        : { data: [] as any[] };
      const ownerToCompany = new Map((sps ?? []).map((s: any) => [s.user_id, s.company_name]));

      setRows((meetings ?? []).map((m: any) => {
        const accId = m.sponsor_account_id ?? sponsorProfAcc.get(m.sponsor_user_id);
        const ownerId = accId ? accToOwner.get(accId) : null;
        const company = ownerId ? ownerToCompany.get(ownerId) : null;
        const resp = m.sponsor_responsable && typeof m.sponsor_responsable === "object" ? m.sponsor_responsable : null;
        const myProf = teamMap.get(m.empresa_user_id) as any;
        return {
          ...m,
          partner_name: company ?? "Solución",
          responsable: resp?.full_name ?? null,
          responsable_role: resp?.role ?? null,
          my_attendee: myProf?.full_name ?? null,
        };
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
                    {r.my_attendee && <span className="inline-flex items-center gap-1 text-primary"><User className="h-3 w-3" />Asiste: {r.my_attendee}</span>}
                    {r.responsable && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{r.responsable}{r.responsable_role ? ` · ${r.responsable_role}` : ""}</span>}
                    {d && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" })}</span>}
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{r.duration_minutes ?? 15} min</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.room ? `Mesa ${r.room}` : "Mesa por asignar"}</span>
                    {r.bloque && <span className="inline-flex items-center gap-1">Bloque: {r.bloque}</span>}
                    {r.slot && <span className="inline-flex items-center gap-1">Slot: {r.slot}</span>}
                    {r.tipo_match && <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{r.tipo_match}</span>}
                    {r.tipo_sponsor && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{r.tipo_sponsor}</span>}
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
