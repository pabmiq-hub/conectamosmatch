import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listEvents } from "@/lib/admin-events.functions";
import { EventModal } from "@/components/admin/EventModal";
import { useAdminEvent } from "@/hooks/use-admin-event";

export const Route = createFileRoute("/_authenticated/admin/eventos/$id/configuracion")({
  head: () => ({ meta: [{ title: "Configuración del evento · Conectamos" }, { name: "description", content: "Edita los datos y reglas de este evento." }] }),
  component: EventConfig,
});

function EventConfig() {
  const { id } = Route.useParams();
  const list = useServerFn(listEvents);
  const navigate = useNavigate();
  const { eventId, setEventId, ready } = useAdminEvent();
  const [ev, setEv] = useState<any | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => { if (ready && eventId !== id) setEventId(id); }, [ready, id]);
  useEffect(() => {
    list({ data: undefined as any }).then((r) => setEv(r.events.find((e: any) => e.id === id) ?? null)).catch((e) => toast.error(e?.message ?? "Error"));
  }, [id, nonce]);
  if (!ev) return <div className="text-xs text-muted-foreground text-uppercase-wide">Cargando…</div>;
  return <EventModal key={nonce} event={ev} onClose={() => navigate({ to: "/admin" })} onSaved={() => setNonce((n) => n + 1)} />;
}
