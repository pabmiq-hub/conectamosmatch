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
      const empAccIds = Array.from(new Set((mts ?? []).map((m: any) => m.empresa_account_id).filter(Boolean)));
      const { data: emps } = empAccIds.length
        ? await supabase.from("empresa_profiles").select("id, company_name").in("id", empAccIds as string[])
        : { data: [] as any[] };
      const accToCompany = new Map((emps ?? []).map((e: any) => [e.id, e.company_name]));

      setMeetings((mts ?? []).map((m: any): AgendaMeeting => {
        const company = m.empresa_account_id ? accToCompany.get(m.empresa_account_id) : null;
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
