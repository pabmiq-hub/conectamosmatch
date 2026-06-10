import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { ClipboardList, Wand2, Trash2, Plus, FileSpreadsheet, FileText, Heart, Sparkles, Building2, CalendarCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { listEvents } from "@/lib/admin-events.functions";
import { listMeetings, autoAssignSlots, updateMeeting, deleteMeeting, clearMeetings } from "@/lib/admin-meetings.functions";
import { listMatches } from "@/lib/admin-matches.functions";
import { listAllParticipants } from "@/lib/admin-meetings.functions";
import { CreateMeetingModal } from "@/components/admin/CreateMeetingModal";
import { ImportMeetingsModal } from "@/components/admin/ImportMeetingsModal";
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
  const [showImport, setShowImport] = useState(false);

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

  // Account-pair key helpers
  const pairKey = (e: string | null | undefined, s: string | null | undefined) => `${e ?? "_"}::${s ?? "_"}`;
  const meetingPairs = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(pairKey(r.empresa_account_id ?? r.empresa_user_id, r.sponsor_account_id ?? r.sponsor_user_id)));
    return set;
  }, [rows]);

  // Matches with NO meeting row at all → render as virtual rows so admin can act on them
  const virtualMatchRows = useMemo(() => {
    return matches
      .filter((m) => !meetingPairs.has(pairKey(m.empresa_account_id ?? m.empresa_user_id, m.sponsor_account_id ?? m.sponsor_user_id)))
      .map((m) => ({
        id: `virtual-${m.id}`,
        virtual: true,
        match_id: m.id,
        event_id: m.event_id,
        empresa_user_id: m.empresa_user_id,
        sponsor_user_id: m.sponsor_user_id,
        empresa_account_id: m.empresa_account_id,
        sponsor_account_id: m.sponsor_account_id,
        empresa_name: m.empresa?.company_name ?? "—",
        sponsor_name: m.sponsor?.company_name ?? "—",
        scheduled_time: null,
        room: null,
        status: "pending",
      }));
  }, [matches, meetingPairs]);

  // Combined universe: real meetings + virtual match rows
  const allRows = useMemo(() => [...rows, ...virtualMatchRows], [rows, virtualMatchRows]);

  // Counts for the three filter buttons
  const counts = useMemo(() => {
    const sinReunion = allRows.filter((r) => !!r.match_id && !r.scheduled_time).length;
    const manual = allRows.filter((r) => !r.match_id && !r.virtual).length;
    const agendadas = allRows.filter((r) => !!r.scheduled_time).length;
    return { sinReunion, manual, agendadas };
  }, [allRows]);

  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      if (empresaFilter && (r.empresa_account_id ?? r.empresa_user_id) !== empresaFilter) return false;
      if (sponsorFilter && (r.sponsor_account_id ?? r.sponsor_user_id) !== sponsorFilter) return false;
      if (viewFilter === "sin-reunion" && !(!!r.match_id && !r.scheduled_time)) return false;
      if (viewFilter === "manual" && (r.match_id || r.virtual)) return false;
      if (viewFilter === "agendadas" && !r.scheduled_time) return false;
      return true;
    });
  }, [allRows, empresaFilter, sponsorFilter, viewFilter]);


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
      "Responsable empresa": r.empresa_responsable?.full_name ?? "",
      Slot: r.slot ?? "",
      Día: r.scheduled_time ? new Date(r.scheduled_time).toLocaleDateString("es-ES") : "",
      Bloque: r.bloque ?? "",
      Hora: r.scheduled_time ? new Date(r.scheduled_time).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "",
      Mesa: r.room ?? "",
      Sponsor: r.sponsor_name ?? "",
      "Tipo Sponsor": r.tipo_sponsor ?? "",
      "Tipo Match": r.tipo_match ?? "",
      Notas: r.notes ?? "",
      Origen: r.match_id ? "Match" : "Manual",
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
          <button onClick={() => setShowImport(true)} disabled={!eventId} className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-xs font-bold text-uppercase-wide disabled:opacity-50">
            <Upload className="h-4 w-4" /> Importar Excel
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
      {showImport && eventId && <ImportMeetingsModal eventId={eventId} onClose={() => setShowImport(false)} onImported={load} />}

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
        <label className="ml-auto inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} /> Agrupar por cuenta
        </label>
        <span className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length === 1 ? "" : "s"}</span>
      </div>

      {/* View-switching tabs */}
      <div className="grid gap-3 md:grid-cols-4">
        <FilterTab active={viewFilter === "all"} onClick={() => setViewFilter("all")} icon={ClipboardList} label="Todas" count={allRows.length} tone="muted" />
        <FilterTab active={viewFilter === "sin-reunion"} onClick={() => setViewFilter("sin-reunion")} icon={Heart} label="Matches sin reunión" count={counts.sinReunion} tone="warning" />
        <FilterTab active={viewFilter === "manual"} onClick={() => setViewFilter("manual")} icon={Wand2} label="Reuniones manuales" count={counts.manual} tone="info" />
        <FilterTab active={viewFilter === "agendadas"} onClick={() => setViewFilter("agendadas")} icon={CalendarCheck} label="Reuniones agendadas" count={counts.agendadas} tone="success" />
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

function FilterTab({ active, onClick, icon: Icon, label, count, tone }: { active: boolean; onClick: () => void; icon: any; label: string; count: number; tone: "warning" | "info" | "muted" | "success" }) {
  const toneActive =
    tone === "warning" ? "border-warning bg-warning/10 text-warning"
    : tone === "info" ? "border-primary bg-primary/10 text-primary"
    : tone === "success" ? "border-success bg-success/10 text-success"
    : "border-foreground bg-muted text-foreground";
  const toneIdle = "border-border bg-card text-muted-foreground hover:bg-muted/50";
  return (
    <button onClick={onClick} className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${active ? toneActive : toneIdle}`}>
      <Icon className="h-4 w-4" />
      <span className="text-[11px] font-bold text-uppercase-wide flex-1">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-card" : "bg-muted"}`}>{count}</span>
    </button>
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
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide ${r.match_id ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>
                  {r.match_id ? "Match" : "Manual"}
                </span>
                {r.virtual && <span className="ml-1 rounded-full bg-warning/15 text-warning px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">Sin asignar</span>}
              </td>
              <td className="px-4 py-3">
                {r.virtual ? (
                  <span className="text-[11px] text-muted-foreground">Usa "Auto-asignar slots"</span>
                ) : (
                  <input type="datetime-local" defaultValue={r.scheduled_time ? new Date(r.scheduled_time).toISOString().slice(0, 16) : ""} onBlur={async (e) => {
                    const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                    if (v === r.scheduled_time) return;
                    try { await onUpdate({ data: { id: r.id, patch: { scheduled_time: v } } }); toast.success("Hora actualizada"); reload(); }
                    catch (err: any) { toast.error(err?.message ?? "Error"); }
                  }} className="rounded-md border border-border bg-input px-2 py-1 text-xs" />
                )}
              </td>
              <td className="px-4 py-3">
                {r.virtual ? <span className="text-[11px] text-muted-foreground">—</span> : (
                  <input defaultValue={r.room ?? ""} onBlur={async (e) => {
                    if (e.target.value === (r.room ?? "")) return;
                    try { await onUpdate({ data: { id: r.id, patch: { room: e.target.value || null } } }); toast.success("Mesa actualizada"); reload(); }
                    catch (err: any) { toast.error(err?.message ?? "Error"); }
                  }} className="w-24 rounded-md border border-border bg-input px-2 py-1 text-xs" />
                )}
              </td>
              <td className="px-4 py-3">
                {r.virtual ? <span className="text-[11px] text-muted-foreground">pending</span> : (
                  <select value={r.status} onChange={async (e) => {
                    try { await onUpdate({ data: { id: r.id, patch: { status: e.target.value as any } } }); toast.success("Estado actualizado"); reload(); }
                    catch (err: any) { toast.error(err?.message ?? "Error"); }
                  }} className="rounded-md border border-border bg-input px-2 py-1 text-xs">
                    {["pending", "confirmed", "completed", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </td>

              <td className="px-4 py-3 text-right">
                {!r.virtual && (
                  <button onClick={async () => {
                    if (!window.confirm("¿Eliminar reunión?")) return;
                    try { await onDelete({ data: { id: r.id } }); toast.success("Eliminada"); reload(); }
                    catch (e: any) { toast.error(e?.message ?? "Error"); }
                  }} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                )}
              </td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
