import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/dashboard/EmptyState";
import { AvailabilityEditor } from "@/components/dashboard/AvailabilityEditor";
import { useEffect, useState } from "react";
import { fetchMyEventScope } from "@/hooks/use-my-event";

export const Route = createFileRoute("/_authenticated/empresa/disponibilidad")({
  component: Page,
});

function Page() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => { fetchMyEventScope().then((s) => setAllowed(!!s.event?.allow_participant_availability)).catch(() => setAllowed(false)); }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Mi disponibilidad" subtitle="Días y franjas en las que puedes tener reuniones 1to1" />
      {allowed === null ? null : allowed ? <AvailabilityEditor /> : (
        <p className="text-sm text-muted-foreground">La organización gestiona la disponibilidad de este evento.</p>
      )}
    </div>
  );
}
