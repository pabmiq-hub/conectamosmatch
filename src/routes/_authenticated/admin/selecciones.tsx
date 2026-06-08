import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { BookmarkCheck, ChevronDown, ChevronRight, Building2, Sparkles, Search, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { listAccountSelections } from "@/lib/admin-selections.functions";
import { SortToggle, sortByName, type SortDir } from "@/components/dashboard/SortToggle";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/selecciones")({
  component: AdminSelecciones,
});

type Side = "empresa" | "sponsor";

type ExportChoice = "empresa" | "sponsor" | "both";

function buildRows(accounts: any[], side: Side) {
  const rows: Record<string, string | number>[] = [];
  accounts.forEach((a: any) => {
    if (!a.targets || a.targets.length === 0) {
      rows.push({
        [side === "empresa" ? "Empresa" : "Solución"]: a.company_name ?? "",
        [side === "empresa" ? "Solución seleccionada" : "Empresa seleccionada"]: "",
        "Vía responsables": "",
        Fecha: "",
      });
      return;
    }
    a.targets.forEach((t: any) => {
      rows.push({
        [side === "empresa" ? "Empresa" : "Solución"]: a.company_name ?? "",
        [side === "empresa" ? "Solución seleccionada" : "Empresa seleccionada"]: t.company_name ?? "",
        "Vía responsables": (t.responsables ?? []).join(", "),
        Fecha: t.created_at ? new Date(t.created_at).toLocaleString("es-ES") : "",
      });
    });
  });
  return rows;
}

function AdminSelecciones() {
  const fn = useServerFn(listAccountSelections);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [side, setSide] = useState<Side>("empresa");
  const [q, setQ] = useState("");
  const [showZero, setShowZero] = useState(true);
  const [dir, setDir] = useState<SortDir>("asc");

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<"excel" | "pdf" | null>(null);
  const [exportChoice, setExportChoice] = useState<ExportChoice>("both");

  useEffect(() => {
    (async () => {
      try {
        const r = await fn({ data: undefined as any });
        setEmpresas(r.empresas);
        setSponsors(r.sponsors);
      } catch (e: any) {
        toast.error(e?.message ?? "Error");
      }
    })();
  }, []);

  const accounts = side === "empresa" ? empresas : sponsors;
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = accounts.filter((a) => {
      if (!showZero && a.total === 0) return false;
      if (!term) return true;
      if ((a.company_name ?? "").toLowerCase().includes(term)) return true;
      return (a.targets ?? []).some((t: any) => (t.company_name ?? "").toLowerCase().includes(term));
    });
    return sortByName(base, (a: any) => a.company_name, dir);
  }, [accounts, q, showZero, dir]);

  const totalSel = filtered.reduce((s, a) => s + a.total, 0);

  function openExport(format: "excel" | "pdf") {
    setPendingFormat(format);
    setExportChoice("both");
    setExportModalOpen(true);
  }

  function confirmExport() {
    if (!pendingFormat) return;
    if (pendingFormat === "excel") {
      doDownloadExcel(exportChoice);
    } else {
      doDownloadPdf(exportChoice);
    }
    setExportModalOpen(false);
    setPendingFormat(null);
  }

  function doDownloadExcel(choice: ExportChoice) {
    const wb = XLSX.utils.book_new();
    const date = new Date().toISOString().slice(0, 10);

    if (choice === "empresa" || choice === "both") {
      const rows = buildRows(empresas, "empresa");
      if (rows.length) {
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Empresas");
      }
    }
    if (choice === "sponsor" || choice === "both") {
      const rows = buildRows(sponsors, "sponsor");
      if (rows.length) {
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Soluciones");
      }
    }

    if (!wb.SheetNames.length) {
      toast.error("Sin datos para exportar");
      return;
    }

    const label = choice === "both" ? "ambos" : choice;
    XLSX.writeFile(wb, `selecciones-${label}-${date}.xlsx`);
  }

  function doDownloadPdf(choice: ExportChoice) {
    const doc = new jsPDF({ orientation: "landscape" });
    const date = new Date().toLocaleString("es-ES");
    let startY = 14;

    const addSection = (title: string, accountsList: any[], sideLabel: Side) => {
      const rows = buildRows(accountsList, sideLabel);
      if (!rows.length) return startY;
      doc.setFontSize(14);
      doc.text(title, 14, startY);
      doc.setFontSize(9);
      doc.text(`${accountsList.length} cuentas · ${rows.length} filas · ${date}`, 14, startY + 6);
      autoTable(doc, {
        startY: startY + 10,
        head: [Object.keys(rows[0])],
        body: rows.map((r) => Object.values(r) as string[]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [107, 0, 255] },
      });
      startY = (doc as any).lastAutoTable?.finalY + 14 || startY + 30;
      return startY;
    };

    if (choice === "empresa" || choice === "both") {
      startY = addSection("Selecciones · Empresas", empresas, "empresa");
    }
    if (choice === "sponsor" || choice === "both") {
      startY = addSection("Selecciones · Soluciones", sponsors, "sponsor");
    }

    if (startY === 14) {
      toast.error("Sin datos para exportar");
      return;
    }

    const label = choice === "both" ? "ambos" : choice;
    doc.save(`selecciones-${label}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Selecciones"
        subtitle="Cuántas cuentas únicas ha seleccionado cada empresa y cada solución"
        right={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => openExport("excel")} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-muted">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
            <button onClick={() => openExport("pdf")} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-muted">
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {([
            { id: "empresa" as Side, label: "Empresas", icon: Building2 },
            { id: "sponsor" as Side, label: "Soluciones", icon: Sparkles },
          ]).map((opt) => {
            const Icon = opt.icon;
            const active = side === opt.id;
            return (
              <button key={opt.id} onClick={() => setSide(opt.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-uppercase-wide ${active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cuenta…"
            className="rounded-md border border-border bg-card pl-7 pr-3 py-1.5 text-xs min-w-[220px]"
          />
        </div>
        <SortToggle value={dir} onChange={setDir} />
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} />
          Mostrar cuentas con 0 selecciones
        </label>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} cuenta{filtered.length === 1 ? "" : "s"} · {totalSel} selecciones totales
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookmarkCheck} title="Sin cuentas" />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => <AccountCard key={a.account_id} account={a} side={side} dir={dir} />)}
        </div>
      )}

      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar selecciones</DialogTitle>
            <DialogDescription>
              Elige qué tipo de cuentas quieres incluir en la exportación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {([
              { id: "empresa" as ExportChoice, label: "Empresas" },
              { id: "sponsor" as ExportChoice, label: "Soluciones" },
              { id: "both" as ExportChoice, label: "Ambos" },
            ]).map((opt) => (
              <label
                key={opt.id}
                className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  exportChoice === opt.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted"
                }`}
              >
                <input
                  type="radio"
                  name="export-choice"
                  value={opt.id}
                  checked={exportChoice === opt.id}
                  onChange={() => setExportChoice(opt.id)}
                  className="h-4 w-4 text-primary"
                />
                <span className="text-sm font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmExport}>
              Exportar {pendingFormat === "excel" ? "Excel" : "PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountCard({ account, side, dir }: { account: any; side: Side; dir: SortDir }) {
  const [open, setOpen] = useState(false);
  const Icon = side === "empresa" ? Building2 : Sparkles;
  const TargetIcon = side === "empresa" ? Sparkles : Building2;
  const otherLabel = side === "empresa" ? "soluciones" : "empresas";
  const zero = account.total === 0;
  const targets = useMemo(() => sortByName(account.targets ?? [], (t: any) => t.company_name, dir), [account.targets, dir]);
  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden ${zero ? "opacity-80" : ""}`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 text-left">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <div className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
          {account.logo_url ? (
            <img src={account.logo_url} alt={account.company_name} className="max-h-full max-w-full object-contain" />
          ) : (
            <Icon className="h-4 w-4 text-primary" />
          )}
        </div>
        <span className="text-sm font-bold truncate">{account.company_name ?? "—"}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide ${zero ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
          {account.total} {account.total === 1 ? "selección" : "selecciones"}
        </span>
      </button>
      {open && account.total > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {targets.map((t: any) => (
            <li key={t.account_id} className="flex items-start gap-3 px-4 py-2.5 text-xs">
              <TargetIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t.company_name}</div>
                {t.responsables.length > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Vía: {t.responsables.join(", ")}
                  </div>
                )}
              </div>
              {t.created_at && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(t.created_at).toLocaleDateString("es-ES")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && account.total === 0 && (
        <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border">
          Esta cuenta aún no ha seleccionado ninguna de las {otherLabel}.
        </div>
      )}
    </div>
  );
}
