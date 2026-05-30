import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function StatCard({ icon: Icon, value, label, hint, accent, to }: {
  icon: LucideIcon; value: string | number; label: string; hint?: string; accent?: boolean; to?: string;
}) {
  const inner = (
    <div className={`rounded-xl border border-border bg-card p-5 ${to ? "card-hover cursor-pointer hover:border-primary/50 transition-colors" : ""}`}>
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent ? "bg-primary text-primary-foreground" : "bg-muted text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-2xl font-bold">{value}</div>
          <div className="text-[11px] text-uppercase-wide text-muted-foreground">{label}</div>
          {hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}
        </div>
      </div>
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return inner;
}
