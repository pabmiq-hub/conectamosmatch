import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import {
  fetchMyMissions, fetchMyPointsLog, formatMadrid, getMyActiveRetoEvent, missionMaxBonus, missionRatio, missionState,
  type MissionRow, type PointsLogRow,
} from "@/lib/reto";
import { CheckCircle2, Lock, RefreshCw, Target, Trophy, History } from "lucide-react";
import { toast } from "sonner";
import { IntroducePanel } from "./RetoIntroductions";

const UNIT: Record<MissionRow["type"], string> = {
  connections: "conexiones",
  companies: "empresas",
  cross_type: "cruzadas",
  sprint: "en el sprint",
  introduction: "presentaciones",
};

export function RetoMissions() {
  const [me, setMe] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [rows, setRows] = useState<MissionRow[]>([]);
  const [log, setLog] = useState<PointsLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (ev: string, uid: string) => {
    setRefreshing(true);
    setError(null);
    try {
      const [m, l] = await Promise.all([fetchMyMissions(ev), fetchMyPointsLog(ev, uid)]);
      setRows(m);
      setLog(l);
    } catch (e: any) {
      const msg = e?.message?.includes("reto_my_missions") ? "Las misiones aún no están preparadas en la base de datos." : (e?.message ?? "No se pudieron cargar las misiones");
      setError(msg);
      toast.error(msg);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setMe(user.id);
      const ev = await getMyActiveRetoEvent(user.id);
      setEventId(ev);
      if (ev) await load(ev, user.id);
      setLoading(false);
    })();
  }, [load]);

  if (loading) return <div className="text-xs text-muted-foreground text-uppercase-wide">Cargando misiones…</div>;
  if (!eventId || !me) return <EmptyState icon={Target} title="El Reto 2.700 no está activo" hint="Aparecerá aquí cuando empiece el evento." />;

  const totalBonus = rows.reduce((s, r) => s + r.awarded_points, 0);
  const done = rows.filter((r) => missionState(r) === "completada").length;
  const titleByCode = Object.fromEntries(rows.map((r) => [r.code, r.title]));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Misiones"
        subtitle="Los bonus se suman solos cuando cumples cada misión. Si una conexión se deshace, el bonus se recalcula."
        right={
          <button onClick={() => load(eventId, me)} disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-accent disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Actualizar
          </button>
        }
      />

      <div className="grid gap-3 grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold text-uppercase-wide text-muted-foreground"><Trophy className="h-3.5 w-3.5" /> Bonus conseguido</div>
          <div className="mt-1 font-display text-2xl font-bold">+{totalBonus}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold text-uppercase-wide text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> Completadas</div>
          <div className="mt-1 font-display text-2xl font-bold">{done}/{rows.length}</div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          {error} <button className="ml-2 font-bold underline" onClick={() => load(eventId, me)}>Reintentar</button>
        </div>
      )}

      <ul className="space-y-3">
        {rows.map((m) => <MissionCard key={m.mission_id} m={m} />)}
      </ul>

      {(() => {
        const intro = rows.find((r) => r.type === "introduction");
        return intro ? <IntroducePanel eventId={eventId} me={me} enabled={!intro.blocked_reason} /> : null;
      })()}

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-[10px] font-bold text-uppercase-wide text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Historial de puntos
        </div>
        {log.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">Aún no has conseguido bonus.</div>
        ) : (
          <ul>
            {log.map((l) => (
              <li key={l.id} className="flex items-center gap-3 border-b border-border px-4 py-2 last:border-0 text-sm">
                <span className={`w-12 font-display font-bold ${l.delta >= 0 ? "text-primary" : "text-destructive"}`}>
                  {l.delta >= 0 ? `+${l.delta}` : l.delta}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {(l.mission_code && titleByCode[l.mission_code]) || l.mission_code}
                  <span className="ml-1 text-xs text-muted-foreground">{l.reason === "award" ? "· conseguida" : "· retirada (se deshizo una conexión o se desactivó)"}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MissionCard({ m }: { m: MissionRow }) {
  const state = missionState(m);
  const ratio = missionRatio(m.progress, m.threshold);
  const shown = Math.min(m.progress, m.threshold);
  return (
    <li className={`rounded-xl border p-4 ${state === "completada" ? "border-primary bg-primary/5" : "border-border bg-card"} ${state === "bloqueada" ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${state === "completada" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          {state === "completada" ? <CheckCircle2 className="h-5 w-5" /> : state === "bloqueada" ? <Lock className="h-4 w-4" /> : <Target className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold">{m.title}</div>
            <span className="shrink-0 font-display text-lg font-bold text-primary">
              +{m.bonus_points}{m.max_awards > 1 && <span className="ml-1 text-[10px] text-muted-foreground">×{m.max_awards} (máx. {missionMaxBonus(m)})</span>}
            </span>
          </div>
          {m.description && <div className="text-sm text-muted-foreground">{m.description}</div>}
          {m.type === "introduction" && (
            <div className="mt-1 text-xs text-muted-foreground">{m.progress}/{m.max_awards} presentaciones validadas · usa el panel «¡Te presento!» de abajo</div>
          )}
          {m.type !== "introduction" && (
            <div className="mt-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${ratio * 100}%` }} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{shown}/{m.threshold} {UNIT[m.type]}</div>
            </div>
          )}
          <div className="mt-2 text-[10px] font-bold text-uppercase-wide">
            {state === "completada" ? (
              <span className="text-primary">Completada · +{m.awarded_points} puntos</span>
            ) : state === "bloqueada" ? (
              <span className="text-muted-foreground">
                Bloqueada · {m.blocked_reason}
                {m.blocked_reason === "Se desbloquea más tarde" && m.starts_at && ` · ${formatMadrid(m.starts_at)}`}
              </span>
            ) : (
              <span>En curso</span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
