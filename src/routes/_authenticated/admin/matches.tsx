import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Heart, ArrowRight, Trash2, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { listMatches, breakMatch } from "@/lib/admin-matches.functions";
import { listEvents } from "@/lib/admin-events.functions";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/admin/matches")({
  component: AdminMatches,
});

function AdminMatches() {
  const list = useServerFn(listMatches);
  const listEv = useServerFn(listEvents);
  const breakM = useServerFn(breakMatch);
  const [rows, setRows] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [sponsorId, setSponsorId] = useState<string>("");

  useEffect(() => { (async () => { try { const r = await listEv({ data: undefined as any }); setEvents(r.events); } catch {} })(); }, []);

  async function load() {
    try { const r = await list({ data: { event_id: eventId || null, status: null } }); setRows(r.matches); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  useEffect(() => { load(); }, [eventId]);

  const sponsorOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => {
      if (r.sponsor_account_id && r.sponsor?.company_name) m.set(r.sponsor_account_id, r.sponsor.company_name);
    });
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(
    () => (sponsorId ? rows.filter((r) => r.sponsor_account_id === sponsorId) : rows),
    [rows, sponsorId],
  );

  function exportRows() {
    return filtered.map((r) => ({
      Empresa: r.empresa?.company_name ?? "",
      "Responsable empresa": r.empresa_responsable?.full_name ?? "",
      Solución: r.sponsor?.company_name ?? "",
      "Responsable solución": r.sponsor_responsable?.full_name ?? "",
      Estado: r.status ?? "",
      Fecha: r.matched_at ? new Date(r.matched_at).toLocaleString("es-ES") : "",
    }));
  }

  function downloadExcel() {
    const data = exportRows();
    if (!data.length) { toast.error("Sin datos para exportar"); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matches");
    XLSX.writeFile(wb, `matches-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function downloadPdf() {
    const data = exportRows();
    if (!data.length) { toast.error("Sin datos para exportar"); return; }
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Matches", 14, 14);
    doc.setFontSize(9);
    doc.text(`${data.length} registros · ${new Date().toLocaleString("es-ES")}`, 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [Object.keys(data[0])],
      body: data.map((r) => Object.values(r) as string[]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [107, 0, 255] },
    });
    doc.save(`matches-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Matches" subtitle="Conexiones mutuas. Cada match crea automáticamente una reunión 1to1" right={
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadExcel} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-muted">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button onClick={downloadPdf} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-muted">
            <FileText className="h-4 w-4" /> PDF
          </button>
        </div>
      } />
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-uppercase-wide text-muted-foreground">Evento</label>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-xs">
          <option value="">Todos</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <label className="text-xs text-uppercase-wide text-muted-foreground ml-2">Solución</label>
        <select value={sponsorId} onChange={(e) => setSponsorId(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-xs min-w-[200px]">
          <option value="">Todas</option>
          {sponsorOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} resultado{filtered.length === 1 ? "" : "s"}</span>
      </div>
      {filtered.length === 0 ? <EmptyState icon={Heart} title="Sin matches" hint="Aparecerán cuando empresa y solución se den like mutuamente" /> : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] text-uppercase-wide text-muted-foreground"><tr>
              <th className="px-4 py-3 text-left">Empresa</th><th /><th className="px-4 py-3 text-left">Solución</th><th className="px-4 py-3 text-left">Estado</th><th className="px-4 py-3 text-left">Fecha</th><th />
            </tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium">{r.empresa?.company_name ?? "—"}</div>
                    {r.empresa_responsable?.full_name && (
                      <div className="text-[10px] text-muted-foreground">
                        {r.empresa_responsable.full_name}
                        {r.empresa_responsable.account_role === "owner" && <span className="ml-1 text-primary">· owner</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-3"><ArrowRight className="h-4 w-4 text-primary" /></td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium">{r.sponsor?.company_name ?? "—"}</div>
                    {r.sponsor_responsable?.full_name && (
                      <div className="text-[10px] text-muted-foreground">
                        {r.sponsor_responsable.full_name}
                        {r.sponsor_responsable.account_role === "owner" && <span className="ml-1 text-primary">· owner</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3"><span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{r.status}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.matched_at && new Date(r.matched_at).toLocaleDateString("es-ES")}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={async () => {
                      if (!window.confirm("¿Romper match? Se eliminará el match, los likes y la reunión asociada.")) return;
                      try { await breakM({ data: { id: r.id } }); toast.success("Match eliminado"); load(); }
                      catch (e: any) { toast.error(e?.message ?? "Error"); }
                    }} className="p-1.5 text-muted-foreground hover:text-destructive" title="Romper match"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
