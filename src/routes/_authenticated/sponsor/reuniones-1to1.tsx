import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSlotInfo } from "@/lib/meeting-slot";
import { fetchMyEventScope } from "@/hooks/use-my-event";
import { MeetingsList } from "@/routes/_authenticated/empresa/reuniones-1to1";

export const Route = createFileRoute("/_authenticated/sponsor/reuniones-1to1")({
  component: ReunionesSponsor,
});

function ReunionesSponsor() {
  const [rows, setRows] = useState<any[]>([]);
  const [published, setPublished] = useState(true);
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
      const ev = (await fetchMyEventScope()).event;
      if (ev) {
        const { data: evRow } = await supabase.from("events").select("meetings_published").eq("id", ev.id).maybeSingle();
        setPublished(!!evRow?.meetings_published);
      }
      const { data: meetings } = teamIds.length && ev
        ? await supabase.from("meetings_1to1").select("*").in("sponsor_user_id", teamIds).eq("event_id", ev.id).order("scheduled_time")
        : { data: [] as any[] };
      const { data: slotWindows } = ev
        ? await supabase.from("event_agenda").select("event_date, time_start, time_end, agenda_type").eq("event_id", ev.id).eq("agenda_type", "reuniones_1to1")
        : { data: [] as any[] };

      const empAccIds = Array.from(new Set((meetings ?? []).map((m: any) => m.empresa_account_id).filter(Boolean)));
      const { data: emps } = empAccIds.length
        ? await supabase.from("empresa_profiles").select("id, company_name, logo_url").in("id", empAccIds as string[])
        : { data: [] as any[] };
      const accMap = new Map((emps ?? []).map((e: any) => [e.id, e]));

      setRows((meetings ?? []).map((m: any) => {
        const ep = accMap.get(m.empresa_account_id);
        const resp = m.empresa_responsable && typeof m.empresa_responsable === "object" ? m.empresa_responsable : null;
        const myProf = teamMap.get(m.sponsor_user_id) as any;
        return {
          ...m,
          slot_label: getSlotInfo(m.scheduled_time, m.duration_minutes, (slotWindows ?? []) as any[])?.label ?? null,
          partner_name: ep?.company_name ?? "Empresa",
          partner_logo: ep?.logo_url ?? null,
          responsable: resp?.full_name ?? null,
          responsable_role: resp?.role ?? null,
          my_attendee: myProf?.full_name ?? null,
        };
      }));
    })();
  }, []);

  return <MeetingsList rows={rows} published={published} />;
}
