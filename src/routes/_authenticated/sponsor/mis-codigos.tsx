import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/sponsor/mis-codigos")({
  component: () => (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-uppercase-wide">Mis códigos</h1>
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">Sección en construcción — datos en vivo conectados a Lovable Cloud.</p>
      </div>
    </div>
  ),
});
