import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { ClipboardList, Wand2, Trash2, Plus, FileSpreadsheet, FileText, Heart, Sparkles, Building2, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { listEvents } from "@/lib/admin-events.functions";
import { listMeetings, autoAssignSlots, updateMeeting, deleteMeeting } from "@/lib/admin-meetings.functions";
import { listMatches } from "@/lib/admin-matches.functions";
import { listAllParticipants } from "@/lib/admin-meetings.functions";
import { CreateMeetingModal } from "@/components/admin/CreateMeetingModal";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/admin/reuniones")({
  component: AdminReuniones,
});

function AdminReuniones() {
  const listEv = useServerFn(listEvents);
  const list = useServerFn(listMeetings);
  const listMatchesFn = useServerFn(listMatches);
  const listParts = useServerFn(listAllParticipants);
  const autoAssign = useServerFn(autoAssignSlots);
  const upd = useServerFn(updateMeeting);
  const del = useServerFn(deleteMeeting);
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [participants, setParticipants] = useState<{ empresas: any[]; sponsors: any[] }>({ empresas: [], sponsors: [] });
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Filters
  const [empresaFilter, setEmpresaFilter] = useState<string>("");
  const [sponsorFilter, setSponsorFilter] = useState<string>("");
  const [viewFilter, setViewFilter] = useState<"all" | "sin-reunion" | "manual" | "agendadas">("all");
  const [grouped, setGrouped] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const [r, p] = await Promise.all([listEv({ data: undefined as any }), listParts()]);
        setEvents(r.events);
        setParticipants(p);
        if (r.events[0]) setEventId(r.events[0].id);
      } catch (e: any) { toast.error(e?.message ?? "Error"); }
    })();
  }, []);

  async function load() {
    if (!eventId) { setRows([]); setMatches([]); return; }
    try {
      const [r, m] = await Promise.all([
        list({ data: { event_id: eventId } }),
        listMatchesFn({ data: { event_id: eventId, status: "mutual" } }),
      ]);
      setRows(r.meetings);
      setMatches(m.matches);
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  useEffect(() => { load(); }, [eventId]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (empresaFilter && (r.empresa_account_id ?? r.empresa_user_id) !== empresaFilter) return false;
      if (sponsorFilter && (r.sponsor_account_id ?? r.sponsor_user_id) !== sponsorFilter) return false;
      if (originFilter === "match" && !r.match_id) return false;
      if (originFilter === "manual" && r.match_id) return false;
      return true;
    });
  }, [rows, empresaFilter, sponsorFilter, originFilter]);

  // Account-pair key helpers
  const pairKey = (e: string | null | undefined, s: string | null | undefined) => `${e ?? "_"}::${s ?? "_"}`;
  const meetingPairs = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(pairKey(r.empresa_account_id ?? r.empresa_user_id, r.sponsor_account_id ?? r.sponsor_user_id)));
    return set;
  }, [rows]);

  // Matches without any meeting
  const matchesSinReunion = useMemo(() => {
    return matches.filter((m) => !meetingPairs.has(pairKey(m.empresa_account_id ?? m.empresa_user_id, m.sponsor_account_id ?? m.sponsor_user_id)));
  }, [matches, meetingPairs]);

  // Manual meetings (no match_id)
  const manualMeetings = useMemo(() => rows.filter((r) => !r.match_id), [rows]);

  // Accounts with no meetings at all in this event
  const accountsWithoutMeetings = useMemo(() => {
    const empWith = new Set<string>();
    const spWith = new Set<string>();
    rows.forEach((r) => {
      if (r.empresa_account_id ?? r.empresa_user_id) empWith.add(r.empresa_account_id ?? r.empresa_user_id);
      if (r.sponsor_account_id ?? r.sponsor_user_id) spWith.add(r.sponsor_account_id ?? r.sponsor_user_id);
    });
    return {
      empresas: participants.empresas.filter((e) => !empWith.has(e.user_id)),
      sponsors: participants.sponsors.filter((s) => !spWith.has(s.user_id)),
    };
  }, [rows, participants]);

  async function runAuto() {
    if (!eventId) return;
    setBusy(true);
    try {
      const r = await autoAssign({ data: { event_id: eventId } });
      toast.success(`Asignadas ${r.assigned} · Sin slot ${r.skipped}`);
      load();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setBusy(false); }
  }

  function exportRows() {
    return filtered.map((r) => ({
      Empresa: r.empresa_name ?? "",
      Solución: r.sponsor_name ?? "",
      Origen: r.match_id ? "Match" : "Manual",
      Hora: r.scheduled_time ? new Date(r.scheduled_time).toLocaleString("es-ES") : "",
      Mesa: r.room ?? "",
      Estado: r.status ?? "",
    }));
  }
  function downloadExcel() {
    const data = exportRows();
    if (!data.length) { toast.error("Sin datos"); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reuniones");
    XLSX.writeFile(wb, `reuniones-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
  function downloadPdf() {
    const data = exportRows();
    if (!data.length) { toast.error("Sin datos"); return; }
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14); doc.text("Reuniones 1to1", 14, 14);
    doc.setFontSize(9); doc.text(`${data.length} registros · ${new Date().toLocaleString("es-ES")}`, 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [Object.keys(data[0])],
      body: data.map((r) => Object.values(r) as string[]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [107, 0, 255] },
    });
    doc.save(`reuniones-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reuniones 1to1" subtitle="Asignación automática y manual de speed-meetings" right={
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadExcel} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-muted">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button onClick={downloadPdf} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-muted">
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-xs font-bold text-uppercase-wide">
            <Plus className="h-4 w-4" /> Crear reunión
          </button>
          <button onClick={runAuto} disabled={busy || !eventId} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
            <Wand2 className="h-4 w-4" /> {busy ? "Asignando…" : "Auto-asignar slots"}
          </button>
        </div>
      } />

      {showCreate && <CreateMeetingModal eventId={eventId || null} onClose={() => setShowCreate(false)} onCreated={load} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <label className="text-[10px] text-uppercase-wide text-muted-foreground">Evento</label>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs">
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <label className="text-[10px] text-uppercase-wide text-muted-foreground">Empresa</label>
        <select value={empresaFilter} onChange={(e) => setEmpresaFilter(e.target.value)} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs min-w-[160px]">
          <option value="">Todas</option>
          {participants.empresas.map((e) => <option key={e.user_id} value={e.user_id}>{e.name}</option>)}
        </select>
        <label className="text-[10px] text-uppercase-wide text-muted-foreground">Solución</label>
        <select value={sponsorFilter} onChange={(e) => setSponsorFilter(e.target.value)} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs min-w-[160px]">
          <option value="">Todas</option>
          {participants.sponsors.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
        </select>
        <label className="text-[10px] text-uppercase-wide text-muted-foreground">Origen</label>
        <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value as any)} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs">
          <option value="all">Todas</option>
          <option value="match">Desde match</option>
          <option value="manual">Manual (sin match)</option>
        </select>
        <label className="ml-auto inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} /> Agrupar por cuenta
        </label>
        <span className="text-xs text-muted-foreground">{filtered.length} reunión{filtered.length === 1 ? "" : "es"}</span>
      </div>

      {/* Diagnostic panels */}
      <div className="grid gap-3 md:grid-cols-3">
        <DiagnosticCard
          icon={Heart}
          title="Matches sin reunión"
          count={matchesSinReunion.length}
          tone="warning"
          items={matchesSinReunion.map((m) => `${m.empresa?.company_name ?? "—"} ↔ ${m.sponsor?.company_name ?? "—"}`)}
        />
        <DiagnosticCard
          icon={Wand2}
          title="Reuniones manuales (sin match)"
          count={manualMeetings.length}
          tone="info"
          items={manualMeetings.map((m) => `${m.empresa_name} ↔ ${m.sponsor_name}`)}
        />
        <DiagnosticCard
          icon={AlertTriangle}
          title="Cuentas sin reuniones"
          count={accountsWithoutMeetings.empresas.length + accountsWithoutMeetings.sponsors.length}
          tone="muted"
          items={[
            ...accountsWithoutMeetings.empresas.map((e) => `🏢 ${e.name}`),
            ...accountsWithoutMeetings.sponsors.map((s) => `✨ ${s.name}`),
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin reuniones" hint="Ajusta filtros o crea una reunión manual" />
      ) : grouped ? (
        <GroupedMeetingsView rows={filtered} onUpdate={upd} onDelete={del} reload={load} />
      ) : (
        <FlatMeetingsTable rows={filtered} onUpdate={upd} onDelete={del} reload={load} />
      )}
    </div>
  );
}

function DiagnosticCard({ icon: Icon, title, count, tone, items }: { icon: any; title: string; count: number; tone: "warning" | "info" | "muted"; items: string[] }) {
  const [open, setOpen] = useState(false);
  const colors = tone === "warning" ? "border-warning/30 bg-warning/5 text-warning" : tone === "info" ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-muted/30 text-muted-foreground";
  return (
    <div className={`rounded-xl border ${colors} p-3`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 text-left">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-bold text-uppercase-wide flex-1">{title}</span>
        <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold">{count}</span>
      </button>
      {open && items.length > 0 && (
        <ul className="mt-2 max-h-40 overflow-y-auto space-y-1 text-[11px] text-foreground">
          {items.map((it, i) => <li key={i} className="truncate">· {it}</li>)}
        </ul>
      )}
      {open && items.length === 0 && <div className="mt-2 text-[11px] text-muted-foreground">Nada por aquí ✓</div>}
    </div>
  );
}

function GroupedMeetingsView({ rows, onUpdate, onDelete, reload }: { rows: any[]; onUpdate: any; onDelete: any; reload: () => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; empresa: string; sponsor: string; items: any[] }>();
    rows.forEach((r) => {
      const key = `${r.empresa_account_id ?? r.empresa_user_id}::${r.sponsor_account_id ?? r.sponsor_user_id}`;
      if (!map.has(key)) map.set(key, { key, empresa: r.empresa_name, sponsor: r.sponsor_name, items: [] });
      map.get(key)!.items.push(r);
    });
    return Array.from(map.values()).sort((a, b) => a.empresa.localeCompare(b.empresa, "es"));
  }, [rows]);

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.key} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b border-border">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold">{g.empresa}</span>
            <span className="text-muted-foreground">×</span>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold">{g.sponsor}</span>
            <span className="ml-auto rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{g.items.length} reunión{g.items.length === 1 ? "" : "es"}</span>
          </div>
          <FlatMeetingsTable rows={g.items} onUpdate={onUpdate} onDelete={onDelete} reload={reload} compact />
        </div>
      ))}
    </div>
  );
}

function FlatMeetingsTable({ rows, onUpdate, onDelete, reload, compact }: { rows: any[]; onUpdate: any; onDelete: any; reload: () => void; compact?: boolean }) {
  return (
    <div className={compact ? "" : "rounded-xl border border-border bg-card overflow-hidden"}>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[10px] text-uppercase-wide text-muted-foreground"><tr>
          {!compact && <><th className="px-4 py-3 text-left">Empresa</th><th className="px-4 py-3 text-left">Solución</th></>}
          <th className="px-4 py-3 text-left">Origen</th>
          <th className="px-4 py-3 text-left">Hora</th><th className="px-4 py-3 text-left">Mesa</th><th className="px-4 py-3 text-left">Estado</th><th />
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              {!compact && <>
                <td className="px-4 py-3 font-medium text-xs">{r.empresa_name}</td>
                <td className="px-4 py-3 font-medium text-xs">{r.sponsor_name}</td>
              </>}
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide ${r.match_id ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  {r.match_id ? "Match" : "Manual"}
                </span>
              </td>
              <td className="px-4 py-3">
                <input type="datetime-local" defaultValue={r.scheduled_time ? new Date(r.scheduled_time).toISOString().slice(0, 16) : ""} onBlur={async (e) => {
                  const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                  if (v === r.scheduled_time) return;
                  try { await onUpdate({ data: { id: r.id, patch: { scheduled_time: v } } }); toast.success("Hora actualizada"); reload(); }
                  catch (err: any) { toast.error(err?.message ?? "Error"); }
                }} className="rounded-md border border-border bg-input px-2 py-1 text-xs" />
              </td>
              <td className="px-4 py-3">
                <input defaultValue={r.room ?? ""} onBlur={async (e) => {
                  if (e.target.value === (r.room ?? "")) return;
                  try { await onUpdate({ data: { id: r.id, patch: { room: e.target.value || null } } }); toast.success("Mesa actualizada"); reload(); }
                  catch (err: any) { toast.error(err?.message ?? "Error"); }
                }} className="w-24 rounded-md border border-border bg-input px-2 py-1 text-xs" />
              </td>
              <td className="px-4 py-3">
                <select value={r.status} onChange={async (e) => {
                  try { await onUpdate({ data: { id: r.id, patch: { status: e.target.value as any } } }); toast.success("Estado actualizado"); reload(); }
                  catch (err: any) { toast.error(err?.message ?? "Error"); }
                }} className="rounded-md border border-border bg-input px-2 py-1 text-xs">
                  {["pending", "confirmed", "completed", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td className="px-4 py-3 text-right">
                <button onClick={async () => {
                  if (!window.confirm("¿Eliminar reunión?")) return;
                  try { await onDelete({ data: { id: r.id } }); toast.success("Eliminada"); reload(); }
                  catch (e: any) { toast.error(e?.message ?? "Error"); }
                }} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
