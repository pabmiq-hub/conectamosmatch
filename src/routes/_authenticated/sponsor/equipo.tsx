import { createFileRoute } from "@tanstack/react-router";
import { EquipoPanel } from "@/components/dashboard/EquipoPanel";

export const Route = createFileRoute("/_authenticated/sponsor/equipo")({
  component: () => <EquipoPanel subtitle="Responsables de tu sponsor y sus reuniones" />,
});
