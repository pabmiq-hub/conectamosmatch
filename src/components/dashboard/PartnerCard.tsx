import { Building2 } from "lucide-react";
import { LevelBadge } from "@/components/brand/LevelBadge";

export interface PartnerCardProps {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  sector?: string | null;
  level?: string | null;
  size?: string | null;
  actions?: React.ReactNode;
}

export function PartnerCard({ name, description, logoUrl, sector, level, size, actions }: PartnerCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 card-hover flex flex-col">
      <div className="h-20 rounded-md bg-background border border-border flex items-center justify-center overflow-hidden">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="max-h-full max-w-full object-contain" />
        ) : (
          <Building2 className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div className="mt-4 flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-bold text-uppercase-wide line-clamp-2">{name}</h3>
        {level && <LevelBadge level={level} />}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {sector && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-uppercase-wide text-muted-foreground">{sector}</span>}
        {size && <span className="text-[10px] text-muted-foreground">{size} empleados</span>}
      </div>
      {description && <p className="mt-3 text-xs text-muted-foreground line-clamp-3 flex-1">{description}</p>}
      {actions && <div className="mt-4 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
