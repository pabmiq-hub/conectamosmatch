import { createFileRoute } from "@tanstack/react-router";
import { EquipoPanel } from "@/components/dashboard/EquipoPanel";

export const Route = createFileRoute("/_authenticated/empresa/equipo")({
  component: () => <EquipoPanel subtitle="Responsables de tu empresa y sus reuniones" />,
});
