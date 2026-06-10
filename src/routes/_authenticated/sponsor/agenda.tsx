import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AgendaTable, type AgendaMeeting } from "@/components/dashboard/AgendaTable";
import { PageHeader } from "@/components/dashboard/EmptyState";

export const Route = createFileRoute("/_authenticated/sponsor/agenda")({
  component: AgendaSponsor,
});

function AgendaSponsor() {
  const [agenda, setAgenda] = useState<any[]>([]);
  const [event, setEvent] = useState<any>(null);
  const [meetings, setMeetings] = useState<AgendaMeeting[]>([]);
  useEffect(() => {
    (async () => {
      const { data: ev } = await supabase.from("events").select("*").in("status", ["published","ongoing"]).order("event_date").limit(1).maybeSingle();
      if (!ev) return;
      setEvent(ev);
      const { data: ag } = await supabase.from("event_agenda").select("*").eq("event_id", ev.id).order("order_index");
      setAgenda(ag ?? []);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: me } = await supabase.from("profiles").select("account_id").eq("id", user.id).maybeSingle();
      const { data: teamProfiles } = me?.account_id
        ? await supabase.from("profiles").select("id, full_name").eq("account_id", me.account_id)
        : { data: [] as any[] };
      const teamIds = (teamProfiles ?? []).map((p: any) => p.id);
      const teamMap = new Map((teamProfiles ?? []).map((p: any) => [p.id, p]));
      const { data: mts } = teamIds.length
        ? await supabase.from("meetings_1to1").select("*").in("sponsor_user_id", teamIds).eq("event_id", ev.id).order("scheduled_time")
        : { data: [] as any[] };
      const empIds = Array.from(new Set((mts ?? []).map((m: any) => m.empresa_user_id).filter(Boolean)));
      const empAccIds = Array.from(new Set((mts ?? []).map((m: any) => m.empresa_account_id).filter(Boolean)));
      const { data: empProfs } = empIds.length
        ? await supabase.from("profiles").select("id, account_id").in("id", empIds)
        : { data: [] as any[] };
      const empProfAcc = new Map((empProfs ?? []).map((p: any) => [p.id, p.account_id]));
      const allEmpAcc = Array.from(new Set([...empAccIds, ...Array.from(empProfAcc.values())].filter(Boolean)));
      const { data: empOwnersAll } = allEmpAcc.length
        ? await supabase.from("profiles").select("id, account_id").eq("account_role", "owner").in("account_id", allEmpAcc as string[])
        : { data: [] as any[] };
      const accToOwner = new Map((empOwnersAll ?? []).map((p: any) => [p.account_id, p.id]));
      const ownerIds = Array.from(new Set((empOwnersAll ?? []).map((p: any) => p.id)));
      const { data: emps } = ownerIds.length
        ? await supabase.from("empresa_profiles").select("user_id, company_name").in("user_id", ownerIds)
        : { data: [] as any[] };
      const ownerToCompany = new Map((emps ?? []).map((e: any) => [e.user_id, e.company_name]));

      setMeetings((mts ?? []).map((m: any): AgendaMeeting => {
        const accId = m.empresa_account_id ?? empProfAcc.get(m.empresa_user_id);
        const ownerId = accId ? accToOwner.get(accId) : null;
        const company = ownerId ? ownerToCompany.get(ownerId) : null;
        const resp = m.empresa_responsable && typeof m.empresa_responsable === "object" ? m.empresa_responsable : null;
        const myProf = teamMap.get(m.sponsor_user_id) as any;
        return {
          id: m.id,
          scheduled_time: m.scheduled_time,
          partner_name: company ?? "Empresa",
          my_attendee: myProf?.full_name ?? null,
          responsable: resp?.full_name ?? null,
          responsable_role: resp?.role ?? null,
          room: m.room ?? null,
        };
      }));
    })();
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Agenda del evento" subtitle={event?.title} />
      <AgendaTable items={agenda} meetings={meetings} />
    </div>
  );
}
