import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyTeam, type TeamMember } from "@/lib/account-team.functions";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Users, Calendar, MapPin } from "lucide-react";

export function EquipoPanel({ subtitle }: { subtitle: string }) {
  const fetchTeam = useServerFn(listMyTeam);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeam().then((d) => { setTeam(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Mi equipo" subtitle={subtitle} />
      {loading ? (
        <EmptyState icon={Users} title="Cargando equipo..." />
      ) : team.length === 0 ? (
        <EmptyState icon={Users} title="Sin responsables" hint="El super administrador puede añadir más responsables a tu cuenta" />
      ) : (
        <div className="space-y-4">
          {team.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                    {(m.full_name ?? "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{m.full_name ?? m.email}</div>
                    <div className="text-[11px] text-muted-foreground">{m.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide ${m.account_role === "owner" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {m.account_role === "owner" ? "Owner" : "Responsable"}
                  </span>
                  {!m.is_active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-uppercase-wide text-muted-foreground">Inactivo</span>}
                </div>
              </div>
              <div className="p-4">
                <h4 className="text-[10px] text-uppercase-wide font-bold text-muted-foreground mb-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> Reuniones 1to1</h4>
                {m.meetings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin reuniones asignadas.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {m.meetings.map((mt) => (
                      <li key={mt.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-xs">
                        <span className="font-medium">{mt.partner_name ?? "—"}</span>
                        <span className="flex items-center gap-3 text-muted-foreground">
                          <span>{mt.scheduled_time ? new Date(mt.scheduled_time).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Pendiente"}</span>
                          {mt.room && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {mt.room}</span>}
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold text-uppercase-wide ${mt.status === "confirmed" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{mt.status ?? "—"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Solo lectura: para añadir o quitar responsables contacta con el super administrador.</p>
    </div>
  );
}
