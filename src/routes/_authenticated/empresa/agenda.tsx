import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AgendaTable } from "@/components/dashboard/AgendaTable";
import { PageHeader } from "@/components/dashboard/EmptyState";

export const Route = createFileRoute("/_authenticated/empresa/agenda")({
  component: AgendaEmpresa,
});

function AgendaEmpresa() {
  const [agenda, setAgenda] = useState<any[]>([]);
  const [event, setEvent] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const { data: ev } = await supabase.from("events").select("*").in("status", ["published","ongoing"]).order("event_date").limit(1).maybeSingle();
      if (!ev) return;
      setEvent(ev);
      const { data: ag } = await supabase.from("event_agenda").select("*").eq("event_id", ev.id).order("order_index");
      setAgenda(ag ?? []);
    })();
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Agenda del evento" subtitle={event?.title} />
      <AgendaTable items={agenda} />
    </div>
  );
}
