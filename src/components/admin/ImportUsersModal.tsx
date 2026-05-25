import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Upload, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { bulkImportUsers } from "@/lib/admin-users.functions";

export function ImportUsersModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const importFn = useServerFn(bulkImportUsers);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: string[]; failed: { email: string; error: string }[] } | null>(null);

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([
      {
        full_name: "Empresa Ejemplo",
        email: "empresa@ejemplo.com",
        password: "Cambiame123",
        role: "empresa",
        phone: "+34600000000",
        company_name: "Ejemplo SL",
        sector: "Tech",
        company_size: "11-50",
        location_city: "Madrid",
        website: "https://ejemplo.com",
        linkedin_url: "",
        tagline: "",
        description: "",
        sponsorship_category: "",
        sponsorship_level: "",
      },
      {
        full_name: "Sponsor Ejemplo",
        email: "sponsor@ejemplo.com",
        password: "Cambiame123",
        role: "sponsor",
        phone: "",
        company_name: "Sponsor SA",
        sector: "Tecnología",
        company_size: "",
        location_city: "",
        website: "https://sponsor.com",
        linkedin_url: "",
        tagline: "",
        description: "",
        sponsorship_category: "Cloud",
        sponsorship_level: "GOLD",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
    XLSX.writeFile(wb, "plantilla-usuarios.xlsx");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      if (!rows.length) {
        toast.error("El fichero está vacío");
        return;
      }
      const res = await importFn({ data: { rows } });
      setResult(res);
      toast.success(`${res.ok.length} creados, ${res.failed.length} con errores`);
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Error procesando el fichero");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-lg font-bold text-uppercase-wide">Importar usuarios desde Excel</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {!result ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-background p-4 text-xs text-muted-foreground space-y-2">
              <p>Descarga la plantilla, rellena las filas y vuelve a subirla. Columnas obligatorias: <strong className="text-foreground">full_name, email, password, role, company_name</strong>.</p>
              <p>Para sponsors usa <code>sponsorship_level</code> (PLATINUM/GOLD/SILVER/BRONZE). Para empresas usa <code>company_size</code> (1-10, 11-50, 51-200, 201-500, 500+).</p>
            </div>
            <button onClick={downloadTemplate} className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border py-2.5 text-xs font-bold text-uppercase-wide">
              <Download className="h-4 w-4" /> Descargar plantilla
            </button>
            <label className="block w-full">
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={busy} className="hidden" />
              <span className={`flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground text-uppercase-wide cursor-pointer ${busy ? "opacity-50" : ""}`}>
                <Upload className="h-4 w-4" /> {busy ? "Procesando…" : "Subir Excel"}
              </span>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
                <FileSpreadsheet className="h-6 w-6 text-success mx-auto" />
                <div className="mt-2 text-2xl font-bold">{result.ok.length}</div>
                <div className="text-[10px] text-uppercase-wide text-muted-foreground">Creados</div>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
                <FileSpreadsheet className="h-6 w-6 text-destructive mx-auto" />
                <div className="mt-2 text-2xl font-bold">{result.failed.length}</div>
                <div className="text-[10px] text-uppercase-wide text-muted-foreground">Con errores</div>
              </div>
            </div>
            {result.failed.length > 0 && (
              <div className="rounded-lg border border-border bg-background p-3 max-h-60 overflow-y-auto">
                <div className="text-xs font-bold mb-2">Errores:</div>
                <ul className="space-y-1 text-xs">
                  {result.failed.map((f, i) => (
                    <li key={i}><span className="font-mono">{f.email}</span> — <span className="text-destructive">{f.error}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <button onClick={onClose} className="w-full rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide">Cerrar</button>
          </div>
        )}
      </div>
    </div>
  );
}
