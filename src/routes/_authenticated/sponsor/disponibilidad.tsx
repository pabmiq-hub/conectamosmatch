import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/dashboard/EmptyState";
import { AvailabilityEditor } from "@/components/dashboard/AvailabilityEditor";

export const Route = createFileRoute("/_authenticated/sponsor/disponibilidad")({
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Mi disponibilidad" subtitle="Días y franjas en las que puedes tener reuniones 1to1" />
      <AvailabilityEditor />
    </div>
  ),
});
