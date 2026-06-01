import { X, Globe, MapPin, User } from "lucide-react";
import { LevelBadge } from "@/components/brand/LevelBadge";
import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listEmpresaResponsables } from "@/lib/admin-users.functions";

export interface PartnerDetail {
  user_id?: string | null;
  company_name: string;
  description?: string | null;
  logo_url?: string | null;
  sector?: string | null;
  website?: string | null;
  location_city?: string | null;
  company_size?: string | null;
  sponsorship_level?: string | null;
  categories?: string[] | null;
  responsables?: { full_name: string; role: string }[] | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  partner: PartnerDetail | null;
  hideLevel?: boolean;
  recommended?: boolean;
}

export function PartnerDetailModal({ open, onClose, partner, hideLevel, recommended }: Props) {
  const fetchResponsables = useServerFn(listEmpresaResponsables);
  const [team, setTeam] = useState<{ full_name: string; role: string }[]>([]);

  useEffect(() => {
    if (!open || !partner?.user_id) { setTeam([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchResponsables({ data: { empresaUserId: partner.user_id!, eventId: null } });
        if (cancelled) return;
        const mapped = (res.responsables ?? [])
          .filter((r: any) => r?.full_name)
          .map((r: any) => ({ full_name: r.full_name as string, role: (r.cargo ?? "") as string }));
        setTeam(mapped);
      } catch { if (!cancelled) setTeam([]); }
    })();
    return () => { cancelled = true; };
  }, [open, partner?.user_id, fetchResponsables]);

  if (!open || !partner) return null;
  const fromProp = (partner.responsables ?? []).filter((r) => r?.full_name);
  const responsables = team.length > 0 ? team : fromProp;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-md border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
              {partner.logo_url ? (
                <img src={partner.logo_url} alt={partner.company_name} className="max-h-full max-w-full object-contain" />
              ) : (
                <Building2 className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-uppercase-wide">{partner.company_name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {partner.sector && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-uppercase-wide text-muted-foreground">{partner.sector}</span>}
                {!hideLevel && partner.sponsorship_level && <LevelBadge level={partner.sponsorship_level} />}
                {recommended && <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-uppercase-wide text-black">Solución recomendada</span>}
                {partner.website && (
                  <a href={partner.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-uppercase-wide font-bold text-primary hover:underline">
                    <Globe className="h-3 w-3" /> {partner.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {partner.location_city && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin className="h-3 w-3" /> {partner.location_city}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="border-t border-border pt-4 space-y-5">
          {partner.description && (
            <div>
              <h3 className="text-[10px] text-uppercase-wide font-bold text-muted-foreground mb-1.5">Sobre la empresa</h3>
              <p className="text-sm text-foreground/90 leading-relaxed">{partner.description}</p>
            </div>
          )}

          {partner.company_size && (
            <div>
              <h3 className="text-[10px] text-uppercase-wide font-bold text-muted-foreground mb-1.5">Datos</h3>
              <p className="text-sm text-foreground/90">{partner.company_size} empleados</p>
            </div>
          )}

          {Array.isArray(partner.categories) && partner.categories.length > 0 && (
            <div>
              <h3 className="text-[10px] text-uppercase-wide font-bold text-muted-foreground mb-1.5">Retos solucionados</h3>
              <div className="flex flex-wrap gap-1.5">
                {partner.categories.map((c) => (
                  <span key={c} className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-foreground/90">{c}</span>
                ))}
              </div>
            </div>
          )}


          <div>
            <h3 className="text-[10px] text-uppercase-wide font-bold text-muted-foreground mb-2">Responsables</h3>
            {responsables.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin responsables asignados.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {responsables.map((r, i) => (
                  <div key={i} className="rounded-md border border-border bg-background px-3 py-2">
                    <div className="inline-flex items-center gap-2 text-sm font-bold">
                      <User className="h-3.5 w-3.5 text-muted-foreground" /> {r.full_name}
                    </div>
                    {r.role && <div className="text-[11px] text-muted-foreground mt-0.5">{r.role}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
