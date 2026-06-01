import { Building2, Heart, Sparkles } from "lucide-react";
import { LevelBadge } from "@/components/brand/LevelBadge";

export interface PartnerCardProps {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  sector?: string | null;
  level?: string | null;
  size?: string | null;
  recommended?: boolean;
  liked?: boolean;
  actions?: React.ReactNode;
}

export function PartnerCard({ name, description, logoUrl, sector, level, size, recommended, liked, actions }: PartnerCardProps) {
  return (
    <div className={`relative rounded-xl border bg-card p-5 card-hover flex flex-col ${liked ? "border-primary shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_55%,transparent),0_16px_34px_-24px_color-mix(in_oklab,var(--primary)_60%,transparent)]" : recommended ? "border-amber-400/70 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]" : "border-border"}`}>
      {liked && (
        <div className="absolute -top-2 left-3 inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-2 py-0.5 text-[9px] font-bold text-uppercase-wide text-primary-foreground shadow">
          <Heart className="h-3 w-3 fill-current" /> Te interesa
        </div>
      )}
      {recommended && (
        <div className={`absolute -top-2 ${liked ? "right-3" : "left-3"} inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold text-uppercase-wide text-black shadow`}>
          <Sparkles className="h-3 w-3" /> Solución recomendada
        </div>
      )}
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
