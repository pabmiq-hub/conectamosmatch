import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import {
  RETO_LEVELS, collectiveFromRows, fetchScoreboard, getMyActiveRetoEvent,
  nextThreshold, pickLeaders, rankBy, reachedThreshold, type RankedRow, type ScoreRow,
} from "@/lib/reto";
import { RetoProgress } from "./RetoProgress";
import { fetchRetoConfig, finalizeIfDue, type RetoConfig } from "@/lib/reto-admin";
import { Crown, Handshake, Heart, RefreshCw, Star, Trophy } from "lucide-react";
import { toast } from "sonner";

type Tab = "connections" | "points";

export function RetoRanking() {
  const [me, setMe] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("connections");
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [cfg, setCfg] = useState<RetoConfig | null>(null);

  const load = useCallback(async (ev: string) => {
    setRefreshing(true);
    try {
      await finalizeIfDue(ev);
      setCfg(await fetchRetoConfig(ev));
      setRows(await fetchScoreboard(ev));
    } catch (e: any) {
      toast.error(e?.message?.includes("reto_scoreboard") ? "El ranking aún no está preparado en la base de datos." : (e?.message ?? "No se pudo cargar el ranking"));
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
      if (ev) await load(ev);
      setLoading(false);
    })();
  }, [load]);

  const collective = useMemo(() => collectiveFromRows(rows), [rows]);
  const ranked = useMemo(() => rankBy(rows, tab), [rows, tab]);
  const leaders = useMemo(() => pickLeaders(rows), [rows]);
  const mine = useMemo(() => rows.find((r) => r.user_id === me) ?? null, [rows, me]);
  const myRow = ranked.find((r) => r.user_id === me) ?? null;
  const top10 = ranked.slice(0, 10);
  const meOutside = myRow && !top10.some((r) => r.user_id === me);

  // Light, one-time celebration for new personal levels.
  // Collective milestones (900/1800/2700) are shown once on entry by the server-tracked pop-up.
  useEffect(() => {
    if (!eventId || !me || !rows.length) return;
    const key = `reto-celebrated:${eventId}:${me}`;
    const seen = JSON.parse(localStorage.getItem(key) ?? '{"l":0}');
    const l = reachedThreshold(mine?.connections ?? 0, RETO_LEVELS);
    let msg: string | null = null;
    if (l > (seen.l ?? 0)) msg = `¡Nivel personal: ${l} conexiones!`;
    localStorage.setItem(key, JSON.stringify({ l: Math.max(l, seen.l ?? 0) }));
    if (msg) {
      toast.success(msg);
      setCelebrate(msg);
      const t = setTimeout(() => setCelebrate(null), 3500);
      return () => clearTimeout(t);
    }
  }, [collective, mine?.connections, eventId, me, rows.length]);

  if (loading) return <div className="text-xs text-muted-foreground text-uppercase-wide">Cargando ranking…</div>;
  if (!eventId) return <EmptyState icon={Trophy} title="El Reto 2.700 no está activo" hint="Aparecerá aquí cuando empiece el evento." />;

  const closed = !!cfg?.is_closed;
  const byId = new Map(rows.map((r) => [r.user_id, r]));
  const official = closed && cfg?.awards_at
    ? { sc: byId.get(cfg.superconector_user_id ?? "") ?? null, al: byId.get(cfg.alma_user_id ?? "") ?? null }
    : null;
  const myLevel = reachedThreshold(mine?.connections ?? 0, RETO_LEVELS);
  const myNext = nextThreshold(mine?.connections ?? 0, RETO_LEVELS);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ranking Reto 2.700"
        subtitle={closed ? "Resultados finales congelados al cierre del Reto." : "Cada conexión recíproca suma 1 al reto colectivo y 1 punto a cada persona."}
        right={
          <button onClick={() => load(eventId)} disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-accent disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Actualizar
          </button>
        }
      />

      {celebrate && (
        <div className="animate-in fade-in zoom-in-95 rounded-xl border border-primary bg-primary/10 px-4 py-3 text-center text-sm font-bold text-primary">
          🎉 {celebrate}
        </div>
      )}

      {closed && (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          <b>El Reto ha terminado.</b> {official ? "Ganadores confirmados por la organización." : "La organización confirmará los ganadores en breve."}
        </div>
      )}

      <RetoProgress value={collective} target={cfg?.target ?? 2700} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Handshake} label="Mis conexiones" value={mine?.connections ?? 0}
          hint={myNext ? `Siguiente nivel: ${myNext}` : "¡Nivel máximo!"} />
        <Stat icon={Star} label="Mis puntos" value={mine?.points ?? 0} hint={`Bonus misiones: ${mine?.bonus ?? 0}`} />
        <Stat icon={Crown} label="Mi nivel" value={myLevel ? `${myLevel}+` : "—"}
          hint={`Niveles: ${RETO_LEVELS.join(" · ")} conexiones`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Leader icon={Trophy} title="Superconector" row={official ? official.sc : leaders.superconector} tie={!official && leaders.superTie} unit="conexiones" metric="connections" tag={official ? "ganador" : closed ? "pendiente de confirmar" : "líder provisional"} />
        <Leader icon={Heart} title="Alma Conectamos" row={official ? official.al : leaders.alma} tie={!official && leaders.almaTie} unit="puntos" metric="points" tag={official ? "ganador" : closed ? "pendiente de confirmar" : "líder provisional"} />
      </div>

      <div className="flex gap-2">
        {([["connections", "Conexiones"], ["points", "Puntos"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold text-uppercase-wide transition-colors ${
              tab === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-2 text-[10px] font-bold text-uppercase-wide text-muted-foreground">Top 10</div>
        <ol>
          {top10.map((r) => <Row key={r.user_id} r={r} me={me} unit={tab === "connections" ? "con." : "pts"} />)}
        </ol>
        {meOutside && myRow && (
          <>
            <div className="border-t border-dashed border-border px-4 py-1 text-center text-[10px] text-muted-foreground">Tu posición</div>
            <ol><Row r={myRow} me={me} unit={tab === "connections" ? "con." : "pts"} /></ol>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ r, me, unit }: { r: RankedRow; me: string | null; unit: string }) {
  const isMe = r.user_id === me;
  return (
    <li className={`flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 ${isMe ? "bg-primary/10" : ""}`}>
      <span className="w-7 text-center font-display text-lg font-bold">{r.rank}</span>
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center text-xs font-bold">
        {r.photo_url ? <img src={r.photo_url} alt={r.display_name} className="h-full w-full object-cover" /> : r.display_name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{r.display_name}{isMe && <span className="ml-1 text-xs text-primary">(tú)</span>}</div>
        <div className="truncate text-xs text-muted-foreground">{r.company_name ?? "—"}</div>
      </div>
      <span className="font-display text-lg font-bold">{r.value}<span className="ml-1 text-[10px] text-muted-foreground">{unit}</span></span>
    </li>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Trophy; label: string; value: number | string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold text-uppercase-wide text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function Leader({ icon: Icon, title, row, tie, unit, metric, tag }: { icon: typeof Trophy; title: string; row: ScoreRow | null; tie: boolean; unit: string; metric: "connections" | "points"; tag: string }) {
  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold text-uppercase-wide text-primary"><Icon className="h-3.5 w-3.5" /> {title} · {tag}</div>
      {row ? (
        <>
          <div className="mt-1 truncate text-sm font-bold">{row.display_name}{tie && <span className="ml-1 text-xs font-normal text-muted-foreground">(empate)</span>}</div>
          <div className="truncate text-xs text-muted-foreground">{row.company_name ?? "—"} · {row[metric]} {unit}</div>
        </>
      ) : (
        <div className="mt-1 text-sm text-muted-foreground">Aún sin puntuación</div>
      )}
    </div>
  );
}
