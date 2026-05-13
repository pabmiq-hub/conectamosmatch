import { createFileRoute } from "@tanstack/react-router";
import { MensajesPanel } from "@/components/dashboard/MensajesPanel";

export const Route = createFileRoute("/_authenticated/sponsor/mensajes")({
  component: () => <MensajesPanel partnerTable="empresa_profiles" />,
});
