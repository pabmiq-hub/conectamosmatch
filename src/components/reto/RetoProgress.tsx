import { RETO_MILESTONES, nextThreshold } from "@/lib/reto";
import { Flag } from "lucide-react";

/** Collective bar 0 → target with milestones 900 / 1.800 / 2.700. */
export function RetoProgress({ value, target = 2700 }: { value: number; target?: number }) {
  const pct = Math.min(100, (value / target) * 100);
  const next = nextThreshold(value, RETO_MILESTONES);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold text-uppercase-wide text-muted-foreground">Reto colectivo</div>
          <div className="font-display text-3xl font-bold leading-none">
            {value.toLocaleString("es-ES")}
            <span className="text-base text-muted-foreground"> / {target.toLocaleString("es-ES")}</span>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {next ? <>Próximo hito: <b className="text-foreground">{next.toLocaleString("es-ES")}</b></> : <b className="text-primary">¡Reto conseguido!</b>}
        </div>
      </div>
      <div className="relative mt-3 h-3 rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
        {RETO_MILESTONES.filter((m) => m <= target).map((m) => (
          <div key={m} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${(m / target) * 100}%` }}>
            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${value >= m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}>
              <Flag className="h-2.5 w-2.5" />
            </div>
          </div>
        ))}
      </div>
      <div className="relative mt-2 h-4 text-[10px] text-muted-foreground">
        {RETO_MILESTONES.filter((m) => m <= target).map((m) => (
          <span key={m} className="absolute -translate-x-1/2 last:-translate-x-full" style={{ left: `${(m / target) * 100}%` }}>
            {m.toLocaleString("es-ES")}
          </span>
        ))}
      </div>
    </div>
  );
}
