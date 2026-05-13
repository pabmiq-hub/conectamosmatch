import { createFileRoute } from "@tanstack/react-router";
import { MensajesPanel } from "@/components/dashboard/MensajesPanel";

export const Route = createFileRoute("/_authenticated/empresa/mensajes")({
  component: () => <MensajesPanel partnerTable="sponsor_profiles" />,
});
