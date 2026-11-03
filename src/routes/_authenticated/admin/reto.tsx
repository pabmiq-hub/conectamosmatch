import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  AlertOctagon, Download, Flag, LockOpen, MessageCircleQuestion, Power, RefreshCw, Target, Trophy,
} from "lucide-react";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { RetoProgress } from "@/components/reto/RetoProgress";
import { RetoParticipantsAdmin } from "@/components/reto/admin/RetoParticipantsAdmin";
import { RetoWinnersAdmin } from "@/components/reto/admin/RetoWinnersAdmin";
import { fetchScoreboard, rankBy, retoDb, type ScoreRow } from "@/lib/reto";
import {
  adminClose, adminEnableEvent, adminReopen, adminSummary, fetchAll, fetchRetoConfig, finalizeIfDue,
  fromMadridLocal, reciprocalPairs, retoPhase, toMadridLocal, type RetoConfig, type RetoPhase, type RetoSummary,
} from "@/lib/reto-admin";

export const Route = createFileRoute("/_authenticated/admin/reto")({
  head: () => ({
    meta: [
      { title: "Reto 2.700 · Admin · Conectamos" },
      { name: "description", content: "Activa, cierra y audita el Reto 2.700: participantes, ganadores y exportaciones." },
      { property: "og:title", content: "Reto 2.700 · Admin" },
      { property: "og:description", content: "Activa, cierra y audita el Reto 2.700: participantes, ganadores y exportaciones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminReto,
});

type Ev = { id: string; title: string; event_date: string | null };

const PHASE: Record<RetoPhase, { label: string; cls: string }> = {
  abierto: { label: "Abierto", cls: "bg-primary/15 text-primary" },
  desactivado: { label: "Desactivado", cls: "bg-muted text-muted-foreground" },
  cierre_pendiente: { label: "Hora de cierre pasada", cls: "bg-accent text-foreground" },
  cerrado: { label: "Cerrado · resultados congelados", cls: "bg-accent text-foreground" },
  emergencia: { label: "Apagado de emergencia", cls: "bg-destructive/15 text-destructive" },
};

const btn = "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-accent disabled:opacity-50";
const madrid = (iso: string | null | undefined) => iso
  ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
  : "";

function AdminReto() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [configured, setConfigured] = useState<string[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [cfg, setCfg] = useState<RetoConfig | null>(null);
  const [summary, setSummary] = useState<RetoSummary | null>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newEvent, setNewEvent] = useState("");

  const loadEvents = useCallback(async () => {
    const [{ data: evs }, { data: cfgs }] = await Promise.all([
      retoDb.from("events").select("id, title, event_date").order("event_date", { ascending: false }),
      retoDb.from("reto_config").select("event_id"),
    ]);
    const ids = (cfgs ?? []).map((c: any) => c.event_id as string);
    setEvents(evs ?? []);
    setConfigured(ids);
    setEventId((cur) => cur && ids.includes(cur) ? cur : ids[0] ?? null);
    setLoading(false);
  }, []);

  const load = useCallback(async (ev: string) => {
    await finalizeIfDue(ev);
    setCfg(await fetchRetoConfig(ev));
    try { setSummary(await adminSummary(ev)); setSummaryErr(null); } catch (e: any) { setSummary(null); setSummaryErr(e.message); }
    try { setRows(await fetchScoreboard(ev)); } catch { setRows([]); }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { if (eventId) load(eventId); }, [eventId, load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); } catch (e: any) { toast.error(e.message ?? "Error"); }
    finally { setBusy(false); if (eventId) load(eventId); }
  };

  const patch = (p: Partial<RetoConfig>, ok: string) => run(async () => {
    const { error } = await retoDb.from("reto_config").update(p).eq("event_id", eventId);
    if (error) throw error;
  }, ok);

  const evTitle = events.find((e) => e.id === eventId)?.title ?? "Reto";
  const fileBase = `reto-2700-${evTitle.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;

  const exportRanking = () => {
    const sheet = (metric: "connections" | "points") => rankBy(rows, metric).map((r) => ({
      Puesto: r.rank, Nombre: r.display_name, Empresa: r.company_name ?? "", Perfil: r.participant_type === "sponsor" ? "Sponsor" : "DRH",
      Conexiones: r.connections, "Bonus misiones": r.bonus, Puntos: r.points,
    }));
    const byId = new Map(rows.map((r) => [r.user_id, r]));
    const sc = byId.get(cfg?.superconector_user_id ?? ""), al = byId.get(cfg?.alma_user_id ?? "");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet("connections")), "Conexiones");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet("points")), "Puntos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Dato: "Estado", Valor: cfg?.is_closed ? `Cerrado el ${madrid(cfg.closed_at)} (resultados congelados)` : "Abierto (datos en vivo)" },
      { Dato: "Conexiones colectivas", Valor: summary?.validated ?? "" },
      { Dato: "Superconector", Valor: sc ? `${sc.display_name} · ${sc.company_name ?? ""} · ${sc.connections} conexiones` : "Sin registrar" },
      { Dato: "Alma Conectamos", Valor: al ? `${al.display_name} · ${al.company_name ?? ""} · ${al.points} puntos` : "Sin registrar" },
      { Dato: "Nota de desempate", Valor: cfg?.awards_note ?? "" },
    ]), "Resumen");
    XLSX.writeFile(wb, `${fileBase}-ranking.xlsx`);
  };

  const exportConnections = () => run(async () => {
    if (!eventId) return;
    const parts = await fetchAll<any>((f, t) => retoDb.from("reto_participants").select("user_id, display_name, company_name").eq("event_id", eventId).range(f, t));
    const names = new Map<string, { n: string; c: string }>();
    parts.forEach((p) => names.set(p.user_id, { n: p.display_name, c: p.company_name ?? "" }));
    rows.forEach((r) => names.set(r.user_id, { n: r.display_name, c: r.company_name ?? "" }));
    let pairs: { a: string; b: string; validated_at: string | null }[];
    let pending: any[] = [];
    if (cfg?.is_closed) {
      const snap = await fetchAll<any>((f, t) => retoDb.from("reto_snapshot_pairs").select("user_a, user_b, validated_at").eq("event_id", eventId).range(f, t));
      pairs = snap.map((s) => ({ a: s.user_a, b: s.user_b, validated_at: s.validated_at }));
    } else {
      const marks = await fetchAll<any>((f, t) => retoDb.from("reto_marks").select("from_user_id, to_user_id, created_at").eq("event_id", eventId).order("created_at").range(f, t));
      const allowed = new Set(parts.map((p) => p.user_id as string));
      const m = marks.map((x) => ({ from: x.from_user_id, to: x.to_user_id, created_at: x.created_at }));
      pairs = reciprocalPairs(m, allowed);
      const set = new Set(m.map((x) => `${x.from}>${x.to}`));
      pending = m.filter((x) => !set.has(`${x.to}>${x.from}`) && allowed.has(x.from) && allowed.has(x.to));
    }
    const nm = (id: string) => names.get(id) ?? { n: id, c: "" };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pairs.map((p) => ({
      "Persona A": nm(p.a).n, "Empresa A": nm(p.a).c, "Persona B": nm(p.b).n, "Empresa B": nm(p.b).c, "Validada (Madrid)": madrid(p.validated_at),
    }))), "Validadas");
    if (!cfg?.is_closed) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pending.map((p) => ({
        "Marca": nm(p.from).n, "Empresa": nm(p.from).c, "A": nm(p.to).n, "Empresa destino": nm(p.to).c, "Fecha (Madrid)": madrid(p.created_at),
      }))), "Pendientes");
    }
    XLSX.writeFile(wb, `${fileBase}-conexiones.xlsx`);
  }, "Conexiones exportadas");

  const exportPoints = () => run(async () => {
    if (!eventId) return;
    const log = await fetchAll<any>((f, t) => retoDb.from("reto_points_log").select("user_id, mission_code, delta, reason, detail, created_at").eq("event_id", eventId).order("created_at").range(f, t));
    const names = new Map(rows.map((r) => [r.user_id, r.display_name]));
    const ws = XLSX.utils.json_to_sheet(log.map((l) => ({
      "Fecha (Madrid)": madrid(l.created_at), Persona: names.get(l.user_id) ?? l.user_id, Misión: l.mission_code ?? "",
      Puntos: l.delta, Tipo: l.reason === "award" ? "Concedido" : "Retirado", Detalle: l.detail ?? "",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial de puntos");
    XLSX.writeFile(wb, `${fileBase}-historial-puntos.xlsx`);
  }, "Historial exportado");

  if (loading) return <div className="text-xs text-muted-foreground text-uppercase-wide">Cargando…</div>;

  const others = events.filter((e) => !configured.includes(e.id));
  const enableBlock = (
    <div className="flex flex-wrap items-center gap-2">
      <select value={newEvent} onChange={(e) => setNewEvent(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
        <option value="">Preparar el Reto en otro evento…</option>
        {others.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
      </select>
      <button className={btn} disabled={!newEvent || busy}
        onClick={() => run(async () => { await adminEnableEvent(newEvent); setNewEvent(""); await loadEvents(); setEventId(newEvent); }, "Reto preparado (desactivado) en el evento")}>
        Preparar
      </button>
    </div>
  );

  if (!eventId) return (
    <div className="space-y-4">
      <EmptyState icon={Trophy} title="Ningún evento tiene el Reto 2.700" hint="Elige un evento para prepararlo. Quedará desactivado hasta que lo actives." />
      {enableBlock}
    </div>
  );

  const phase = retoPhase(cfg, Date.now());
  const closed = !!cfg?.is_closed;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reto 2.700"
        subtitle="Solo los administradores ven este panel. Las conexiones y puntos los calcula siempre la base de datos."
        right={<button onClick={() => load(eventId)} disabled={busy} className={btn}><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Actualizar</button>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
          {configured.map((id) => <option key={id} value={id}>{events.find((e) => e.id === id)?.title ?? id}</option>)}
        </select>
        <span className={`rounded-full px-3 py-1 text-[10px] font-bold text-uppercase-wide ${PHASE[phase].cls}`}>{PHASE[phase].label}</span>
      </div>

      {summaryErr && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">{summaryErr}</div>
      )}

      {/* Controles */}
      {cfg && (
        <section className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <span>
                <span className="block text-xs font-bold text-uppercase-wide">Juego activo</span>
                <span className="text-[11px] text-muted-foreground">Los participantes ven el Reto en su menú</span>
              </span>
              <input type="checkbox" className="h-5 w-5" checked={cfg.is_active} disabled={busy}
                onChange={(e) => patch({ is_active: e.target.checked }, e.target.checked ? "Reto activado" : "Reto desactivado")} />
            </label>
            <label className="space-y-1 rounded-lg border border-border p-3">
              <span className="block text-xs font-bold text-uppercase-wide">Objetivo colectivo</span>
              <input type="number" min={1} defaultValue={cfg.target} key={`t-${cfg.target}`} disabled={busy}
                onBlur={(e) => { const v = parseInt(e.target.value, 10); if (v > 0 && v !== cfg.target) patch({ target: v }, "Objetivo guardado"); }}
                className="w-full rounded border border-border bg-background px-2 py-1 text-sm" />
            </label>
            <label className="space-y-1 rounded-lg border border-border p-3">
              <span className="block text-xs font-bold text-uppercase-wide">Hora de cierre (Madrid)</span>
              <input type="datetime-local" defaultValue={toMadridLocal(cfg.closes_at)} key={`c-${cfg.closes_at}`} disabled={busy || closed}
                onBlur={(e) => { const v = fromMadridLocal(e.target.value); if (v !== cfg.closes_at) patch({ closes_at: v }, v ? "Hora de cierre guardada" : "Hora de cierre quitada"); }}
                className="w-full rounded border border-border bg-background px-2 py-1 text-sm" />
              <span className="block text-[10px] text-muted-foreground">Al llegar, se bloquean las marcas y se congelan los resultados.</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {!closed ? (
              <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-uppercase-wide text-primary-foreground disabled:opacity-50" disabled={busy}
                onClick={() => { if (confirm("¿Cerrar el Reto ahora? Se congelan conexiones y puntos, y nadie podrá marcar más. Se puede reabrir.")) run(() => adminClose(eventId), "Reto cerrado y resultados congelados"); }}>
                <Flag className="h-4 w-4" /> Cerrar ahora
              </button>
            ) : (
              <button className={btn} disabled={busy}
                onClick={() => { if (confirm("¿Reabrir el Reto? Se vuelve a permitir marcar y se borran los ganadores registrados. La última instantánea se guarda hasta el próximo cierre.")) run(() => adminReopen(eventId), "Reto reabierto"); }}>
                <LockOpen className="h-4 w-4" /> Reabrir
              </button>
            )}
            {!cfg.emergency_off ? (
              <button className="inline-flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-uppercase-wide text-destructive-foreground disabled:opacity-50" disabled={busy}
                onClick={() => { if (confirm("¿Apagar el Reto de emergencia? Desaparece del menú de todos los participantes. El resto de la plataforma y las reuniones siguen igual.")) patch({ emergency_off: true }, "Reto apagado de emergencia"); }}>
                <AlertOctagon className="h-4 w-4" /> Apagado de emergencia
              </button>
            ) : (
              <button className={btn} disabled={busy} onClick={() => patch({ emergency_off: false }, "Reto encendido de nuevo")}>
                <Power className="h-4 w-4" /> Volver a encender
              </button>
            )}
            <Link to="/admin/reto-misiones" className={btn}><Target className="h-4 w-4" /> Misiones y horarios</Link>
            <Link to="/admin/reto-comodines" className={btn}><MessageCircleQuestion className="h-4 w-4" /> Comodines</Link>
          </div>
          {closed && <p className="text-xs text-muted-foreground">Cerrado el {madrid(cfg.closed_at)}. Los participantes ven su álbum y el ranking final en solo lectura.</p>}
        </section>
      )}

      {/* Resumen y auditoría */}
      {summary && cfg && (
        <section className="space-y-3">
          <RetoProgress value={summary.validated} target={cfg.target} />
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Stat label="Conexiones validadas" value={summary.validated} />
            <Stat label="Marcas pendientes" value={summary.pending} hint="Una persona marcó y la otra aún no" />
            <Stat label="Participantes" value={summary.participants} hint={`${summary.drh} DRH · ${summary.sponsors} sponsors`} />
            <Stat label="Bonus de misiones" value={summary.bonus_total} hint={`${summary.awards} misiones conseguidas`} />
            <Stat label="Te presento" value={summary.intros_validated} hint={`${summary.intros_pending} pendientes`} />
            <Stat label="Puntos retirados" value={summary.revokes} hint="Anotaciones de retirada en el historial" />
            <Stat label="Última marca" value={summary.last_mark_at ? madrid(summary.last_mark_at) : "—"} />
            <Stat label="Instantánea" value={summary.snapshot_at ? madrid(summary.snapshot_at) : "—"} hint={summary.snapshot_rows ? `${summary.snapshot_rows} personas congeladas` : "Se crea al cerrar"} />
          </div>
        </section>
      )}

      {cfg && <RetoWinnersAdmin eventId={eventId} cfg={cfg} rows={rows} onSaved={() => load(eventId)} />}

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="text-xs font-bold text-uppercase-wide">Exportar (Excel)</div>
        <p className="text-xs text-muted-foreground">{closed ? "Con el Reto cerrado se exportan los resultados congelados." : "Con el Reto abierto se exportan los datos en vivo."}</p>
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={busy || !rows.length} onClick={exportRanking}><Download className="h-4 w-4" /> Ranking y ganadores</button>
          <button className={btn} disabled={busy} onClick={exportConnections}><Download className="h-4 w-4" /> Conexiones</button>
          <button className={btn} disabled={busy} onClick={exportPoints}><Download className="h-4 w-4" /> Historial de puntos</button>
        </div>
      </section>

      <RetoParticipantsAdmin eventId={eventId} locked={closed} onChanged={() => load(eventId)} />

      <details className="rounded-xl border border-border bg-card p-4 text-sm">
        <summary className="cursor-pointer text-xs font-bold text-uppercase-wide">Procedimiento de activación y plan de reversión</summary>
        <div className="mt-3 space-y-3 text-xs leading-relaxed">
          <div>
            <b>Activación final</b>
            <ol className="ml-4 list-decimal space-y-1">
              <li>Una semana antes: crear a las personas nuevas en Usuarios → Importar.</li>
              <li>Preparar el Reto en el evento real (selector de arriba) y subir aquí el listado definitivo con la columna «Email».</li>
              <li>Revisar misiones y horas en «Misiones y horarios» y los 27 comodines.</li>
              <li>Poner la hora de cierre y el objetivo (2.700).</li>
              <li>Probar con 2–3 cuentas de prueba antes de abrir.</li>
              <li>El día del evento, marcar «Juego activo».</li>
              <li>Al final: esperar a la hora de cierre o pulsar «Cerrar ahora», exportar ranking, resolver empates y registrar ganadores.</li>
            </ol>
          </div>
          <div>
            <b>Plan de reversión</b>
            <ul className="ml-4 list-disc space-y-1">
              <li>Problema grave durante el evento: «Apagado de emergencia». El Reto desaparece del menú; reuniones, matches y el resto siguen igual. Ningún dato se borra.</li>
              <li>Cierre por error: «Reabrir». Las marcas siguen intactas y el siguiente cierre crea una instantánea nueva.</li>
              <li>Baja por error: volver a añadir a la persona. Recupera sus conexiones y bonus.</li>
              <li>Retirada total del módulo: desactivar «Juego activo». Las tablas del Reto están separadas del resto de la plataforma.</li>
            </ul>
          </div>
        </div>
      </details>

      {others.length > 0 && enableBlock}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] font-bold text-uppercase-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
