import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Heart, ArrowRight, Trash2, FileSpreadsheet, FileText, ChevronDown, ChevronRight, Building2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { listMatches, breakMatch } from "@/lib/admin-matches.functions";
import { listEvents } from "@/lib/admin-events.functions";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/admin/matches")({
  component: AdminMatches,
});

type Mode = "pairs" | "by-empresa" | "by-sponsor";

function AdminMatches() {
  const list = useServerFn(listMatches);
  const listEv = useServerFn(listEvents);
  const breakM = useServerFn(breakMatch);
  const [rows, setRows] = useState<any[]>([]);
  const [allEmpresas, setAllEmpresas] = useState<any[]>([]);
  const [allSponsors, setAllSponsors] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [sponsorId, setSponsorId] = useState<string>("");
  const [mode, setMode] = useState<Mode>("by-empresa");
  const [showZero, setShowZero] = useState(true);

  useEffect(() => { (async () => { try { const r = await listEv({ data: undefined as any }); setEvents(r.events); } catch {} })(); }, []);

  async function load() {
    try {
      const r = await list({ data: { event_id: eventId || null, status: null } });
      setRows(r.matches);
      setAllEmpresas(r.allEmpresas ?? []);
      setAllSponsors(r.allSponsors ?? []);
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  useEffect(() => { load(); }, [eventId]);

  const sponsorOptions = useMemo(
    () => [...allSponsors].sort((a, b) => (a.company_name ?? "").localeCompare(b.company_name ?? "", "es")),
    [allSponsors],
  );

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

  async function onBreak(id: string) {
    if (!window.confirm("¿Romper match? Se eliminará el match, los likes y la reunión asociada.")) return;
    try { await breakM({ data: { id } }); toast.success("Match eliminado"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
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
          {sponsorOptions.map((s) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {([
              { id: "by-empresa", label: "Por empresa" },
              { id: "by-sponsor", label: "Por solución" },
              { id: "pairs", label: "Pares" },
            ] as { id: Mode; label: string }[]).map((opt) => (
              <button key={opt.id} onClick={() => setMode(opt.id)} className={`px-3 py-1.5 text-[11px] font-bold text-uppercase-wide ${mode === opt.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                {opt.label}
              </button>
            ))}
          </div>
          {mode !== "pairs" && (
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} /> Mostrar 0 matches
            </label>
          )}
          <span className="text-xs text-muted-foreground">{filtered.length} match{filtered.length === 1 ? "" : "es"}</span>
        </div>
      </div>

      {mode === "pairs" ? (
        filtered.length === 0 ? <EmptyState icon={Heart} title="Sin matches" hint="Aparecerán cuando empresa y solución se den like mutuamente" /> : (
          <GroupedMatches rows={filtered} onBreak={onBreak} />
        )
      ) : (
        <AccountOverview
          side={mode === "by-empresa" ? "empresa" : "sponsor"}
          rows={filtered}
          accounts={mode === "by-empresa" ? allEmpresas : allSponsors}
          showZero={showZero}
          onBreak={onBreak}
        />
      )}
    </div>
  );
}

function AccountOverview({ side, rows, accounts, showZero, onBreak }: { side: "empresa" | "sponsor"; rows: any[]; accounts: any[]; showZero: boolean; onBreak: (id: string) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const byAccount = useMemo(() => {
    const m = new Map<string, any[]>();
    rows.forEach((r) => {
      const k = side === "empresa" ? r.empresa_account_id : r.sponsor_account_id;
      if (!k) return;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    return m;
  }, [rows, side]);
  const list = useMemo(() => {
    const arr = accounts.map((a) => ({ ...a, count: byAccount.get(a.id)?.length ?? 0, items: byAccount.get(a.id) ?? [] }));
    return arr
      .filter((a) => showZero || a.count > 0)
      .sort((a, b) => (b.count - a.count) || (a.company_name ?? "").localeCompare(b.company_name ?? "", "es"));
  }, [accounts, byAccount, showZero]);
  const Icon = side === "empresa" ? Building2 : Sparkles;
  const otherLabel = side === "empresa" ? "soluciones" : "empresas";
  if (list.length === 0) return <EmptyState icon={Heart} title="Sin cuentas" />;
  return (
    <div className="space-y-2">
      {list.map((a) => {
        const isOpen = open[a.id] ?? false;
        const zero = a.count === 0;
        return (
          <div key={a.id} className={`rounded-xl border bg-card overflow-hidden ${zero ? "border-border opacity-80" : "border-border"}`}>
            <button onClick={() => setOpen((o) => ({ ...o, [a.id]: !isOpen }))} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 text-left">
              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">{a.company_name ?? "—"}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide ${zero ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                {a.count} {a.count === 1 ? "match" : "matches"}
              </span>
            </button>
            {isOpen && a.count > 0 && (
              <ul className="divide-y divide-border border-t border-border">
                {a.items.map((r: any) => {
                  const other = side === "empresa" ? r.sponsor : r.empresa;
                  const otherResp = side === "empresa" ? r.sponsor_responsable : r.empresa_responsable;
                  const meResp = side === "empresa" ? r.empresa_responsable : r.sponsor_responsable;
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{other?.company_name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {meResp?.full_name ?? "—"}{meResp?.account_role === "owner" && <span className="ml-1 text-primary">· owner</span>}
                          <span className="mx-1.5">↔</span>
                          {otherResp?.full_name ?? "—"}{otherResp?.account_role === "owner" && <span className="ml-1 text-primary">· owner</span>}
                        </div>
                      </div>
                      <span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{r.status}</span>
                      <span className="text-[10px] text-muted-foreground">{r.matched_at && new Date(r.matched_at).toLocaleDateString("es-ES")}</span>
                      <button onClick={() => onBreak(r.id)} className="p-1.5 text-muted-foreground hover:text-destructive" title="Romper match"><Trash2 className="h-4 w-4" /></button>
                    </li>
                  );
                })}
              </ul>
            )}
            {isOpen && a.count === 0 && (
              <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border">Sin {otherLabel} con match todavía.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GroupedMatches({ rows, onBreak }: { rows: any[]; onBreak: (id: string) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; empresa: string; sponsor: string; items: any[] }>();
    rows.forEach((r) => {
      const empName = r.empresa?.company_name ?? "—";
      const spName = r.sponsor?.company_name ?? "—";
      const key = `${r.empresa_account_id ?? r.empresa_user_id}::${r.sponsor_account_id ?? r.sponsor_user_id}`;
      if (!map.has(key)) map.set(key, { key, empresa: empName, sponsor: spName, items: [] });
      map.get(key)!.items.push(r);
    });
    return Array.from(map.values()).sort((a, b) => a.empresa.localeCompare(b.empresa, "es") || a.sponsor.localeCompare(b.sponsor, "es"));
  }, [rows]);
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.key} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b border-border">
            <span className="text-sm font-bold">{g.empresa}</span>
            <ArrowRight className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">{g.sponsor}</span>
            <span className="ml-auto rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{g.items.length} match{g.items.length === 1 ? "" : "es"} entre responsables</span>
          </div>
          <ul className="divide-y divide-border">
            {g.items.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted-foreground">
                    {r.empresa_responsable?.full_name ?? "Responsable empresa"}
                    {r.empresa_responsable?.account_role === "owner" && <span className="ml-1 text-primary">· owner</span>}
                    <span className="mx-1.5">↔</span>
                    {r.sponsor_responsable?.full_name ?? "Responsable solución"}
                    {r.sponsor_responsable?.account_role === "owner" && <span className="ml-1 text-primary">· owner</span>}
                  </div>
                </div>
                <span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{r.status}</span>
                <span className="text-[10px] text-muted-foreground">{r.matched_at && new Date(r.matched_at).toLocaleDateString("es-ES")}</span>
                <button onClick={() => onBreak(r.id)} className="p-1.5 text-muted-foreground hover:text-destructive" title="Romper match"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
