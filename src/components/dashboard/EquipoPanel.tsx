import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyTeam, type TeamMember } from "@/lib/account-team.functions";
import { listMyAccountRequests, cancelMyRequest } from "@/lib/responsable-requests.functions";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { RequestResponsableModal } from "@/components/dashboard/RequestResponsableModal";
import { supabase } from "@/integrations/supabase/client";
import { Users, Calendar, MapPin, UserPlus, Clock, X } from "lucide-react";
import { toast } from "sonner";

type Req = { id: string; full_name: string; email: string; phone: string | null; status: string; rejection_reason: string | null; created_at: string };

export function EquipoPanel({ subtitle }: { subtitle: string }) {
  const fetchTeam = useServerFn(listMyTeam);
  const fetchRequests = useServerFn(listMyAccountRequests);
  const cancelReq = useServerFn(cancelMyRequest);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  async function load() {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    if (session.session) {
      const { data: me } = await supabase.from("profiles").select("account_role").eq("id", session.session.user.id).maybeSingle();
      setIsOwner(me?.account_role === "owner");
    }
    const [t, r] = await Promise.all([fetchTeam(), fetchRequests()]);
    setTeam(t);
    setRequests(r as Req[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const pending = requests.filter((r) => r.status === "pending");
  const past = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <PageHeader title="Mi equipo" subtitle={subtitle} right={isOwner ? (
        <button onClick={() => setShowRequest(true)} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide">
          <UserPlus className="h-4 w-4" /> Solicitar responsable
        </button>
      ) : undefined} />

      {showRequest && <RequestResponsableModal onClose={() => setShowRequest(false)} onCreated={load} />}

      {pending.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-4 py-2.5 text-[10px] font-bold text-uppercase-wide text-muted-foreground flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" /> Solicitudes pendientes ({pending.length})
          </div>
          <ul className="divide-y divide-border">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-bold">{r.full_name}</div>
                  <div className="text-[11px] text-muted-foreground">{r.email}{r.phone ? ` · ${r.phone}` : ""}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-warning/10 text-warning px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">Pendiente</span>
                  {isOwner && (
                    <button title="Cancelar" onClick={async () => {
                      if (!window.confirm("¿Cancelar la solicitud?")) return;
                      try { await cancelReq({ data: { id: r.id } }); toast.success("Solicitud cancelada"); load(); }
                      catch (e: any) { toast.error(e?.message ?? "Error"); }
                    }} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <EmptyState icon={Users} title="Cargando equipo..." />
      ) : team.length === 0 ? (
        <EmptyState icon={Users} title="Sin responsables" hint={isOwner ? "Pulsa “Solicitar responsable” para añadir un compañero" : "El owner puede solicitar nuevos responsables"} />
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

      {past.length > 0 && (
        <details className="rounded-xl border border-border bg-card overflow-hidden">
          <summary className="cursor-pointer border-b border-border bg-muted/30 px-4 py-2.5 text-[10px] font-bold text-uppercase-wide text-muted-foreground">
            Historial de solicitudes ({past.length})
          </summary>
          <ul className="divide-y divide-border">
            {past.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-bold">{r.full_name}</div>
                  <div className="text-[11px] text-muted-foreground">{r.email}{r.rejection_reason ? ` · ${r.rejection_reason}` : ""}</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide ${r.status === "approved" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{r.status}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
