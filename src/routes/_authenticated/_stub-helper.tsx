import { createFileRoute, Link } from "@tanstack/react-router";

function makeStub(title: string, hint?: string) {
  return function Stub() {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-uppercase-wide">{title}</h1>
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">{hint ?? "Próximamente — esta sección está siendo construida."}</p>
          <Link to="/" className="mt-4 inline-block text-xs text-primary text-uppercase-wide font-bold hover:underline">← Inicio</Link>
        </div>
      </div>
    );
  };
}

export { makeStub };
export const Route = createFileRoute("/_authenticated/_stub-helper")({
  component: () => null,
});
