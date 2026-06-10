import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Calendar } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { importMeetingsFromExcel } from "@/lib/admin-meetings.functions";
import { supabase } from "@/integrations/supabase/client";

type ParsedRow = {
  empresa: string;
  responsable_empresa?: string | null;
  slot?: string | null;
  bloque?: string | null;
  dia: number;
  hora: string;
  mesa?: string | number | null;
  submesa?: string | null;
  sponsor: string;
  tipo_sponsor?: string | null;
  tipo_match?: string | null;
  notas?: string | null;
};

const HEADER_ALIASES: Record<string, keyof ParsedRow | "ignore"> = {
  "empresa": "empresa",
  "responsable empresa": "responsable_empresa",
  "responsable": "responsable_empresa",
  "slot": "slot",
  "dia": "dia",
  "día": "dia",
  "bloque": "bloque",
  "hora": "hora",
  "mesa": "mesa",
  "submesa": "submesa",
  "sponsor": "sponsor",
  "solucion": "sponsor",
  "solución": "sponsor",
  "tipo sponsor": "tipo_sponsor",
  "tipo match": "tipo_match",
  "notas": "notas",
};

function parseDia(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const m = String(value).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

export function ImportMeetingsModal({ eventId, onClose, onImported }: { eventId: string; onClose: () => void; onImported: () => void }) {
  const importFn = useServerFn(importMeetingsFromExcel);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [replaceAll, setReplaceAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; total: number; errors: { row: number; reason: string }[] } | null>(null);

  const maxDia = useMemo(() => rows.reduce((acc, r) => Math.max(acc, r.dia || 0), 0), [rows]);
  const [dayDates, setDayDates] = useState<Record<number, string>>({});
  const [agendaDates, setAgendaDates] = useState<string[]>([]);
  const [agendaLoaded, setAgendaLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("event_agenda")
        .select("event_date")
        .eq("event_id", eventId)
        .not("event_date", "is", null)
        .order("event_date", { ascending: true });
      const uniq = Array.from(new Set((data ?? []).map((r: any) => r.event_date).filter(Boolean)));
      // fallback to event.event_date / end_date if no agenda items
      if (!uniq.length) {
        const { data: ev } = await supabase.from("events").select("event_date,end_date").eq("id", eventId).maybeSingle();
        if (ev?.event_date) {
          const start = new Date(ev.event_date);
          const end = ev.end_date ? new Date(ev.end_date) : start;
          for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
            uniq.push(new Date(t).toISOString().slice(0, 10));
          }
        }
      }
      setAgendaDates(uniq);
      setAgendaLoaded(true);
    })();
  }, [eventId]);

  async function onFile(file: File) {
    setParseError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
      if (!raw.length) throw new Error("Hoja vacía");
      const header = raw[0].map((h: any) => String(h ?? "").trim().toLowerCase());
      const colMap: Record<number, keyof ParsedRow | "ignore"> = {};
      header.forEach((h, i) => {
        const key = HEADER_ALIASES[h];
        if (key) colMap[i] = key;
      });
      const required: (keyof ParsedRow)[] = ["empresa", "dia", "hora", "sponsor"];
      const present = new Set(Object.values(colMap));
      const missing = required.filter((k) => !present.has(k));
      if (missing.length) throw new Error(`Faltan columnas: ${missing.join(", ")}`);

      const parsed: ParsedRow[] = [];
      for (let r = 1; r < raw.length; r++) {
        const row = raw[r];
        if (!row || row.every((c) => c === null || c === undefined || c === "")) continue;
        const obj: any = {};
        Object.entries(colMap).forEach(([idx, key]) => {
          if (key === "ignore") return;
          obj[key] = row[Number(idx)];
        });
        const dia = parseDia(obj.dia);
        if (!obj.empresa || !obj.sponsor || !obj.hora || !dia) continue;
        parsed.push({
          empresa: String(obj.empresa).trim(),
          responsable_empresa: obj.responsable_empresa ? String(obj.responsable_empresa).trim() : null,
          slot: obj.slot !== undefined && obj.slot !== null && obj.slot !== "" ? String(obj.slot).trim() : null,
          bloque: obj.bloque !== undefined && obj.bloque !== null && obj.bloque !== "" ? String(obj.bloque).trim() : null,
          dia,
          hora: String(obj.hora).trim(),
          mesa: obj.mesa ?? null,
          submesa: obj.submesa ? String(obj.submesa).trim() : null,
          sponsor: String(obj.sponsor).trim(),
          tipo_sponsor: obj.tipo_sponsor ? String(obj.tipo_sponsor).trim() : null,
          tipo_match: obj.tipo_match ? String(obj.tipo_match).trim() : null,
          notas: obj.notas ? String(obj.notas).trim() : null,
        });
      }
      if (!parsed.length) throw new Error("No se encontraron filas válidas");
      setRows(parsed);
      // initialize day dates with today + (n-1)
      const top = parsed.reduce((a, r) => Math.max(a, r.dia), 0);
      const today = new Date();
      const init: Record<number, string> = {};
      for (let i = 1; i <= top; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + (i - 1));
        init[i] = d.toISOString().slice(0, 10);
      }
      setDayDates(init);
    } catch (e: any) {
      setParseError(e?.message ?? "Error leyendo el archivo");
      setRows([]);
    }
  }

  async function submit() {
    if (!rows.length) return;
    for (let i = 1; i <= maxDia; i++) {
      if (!dayDates[i]) { toast.error(`Falta fecha para Día ${i}`); return; }
    }
    setBusy(true);
    try {
      const day_dates: string[] = [];
      for (let i = 1; i <= maxDia; i++) day_dates.push(dayDates[i]);
      const res = await importFn({ data: { event_id: eventId, day_dates, replace_all: replaceAll, rows } });
      setResult(res);
      if (res.errors.length === 0) {
        toast.success(`Importadas ${res.imported} reuniones`);
        onImported();
      } else {
        toast.warning(`${res.imported} importadas · ${res.errors.length} con problemas`);
        onImported();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Error al importar");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-uppercase-wide">Importar reuniones desde Excel</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-3">
              Columnas esperadas: <strong>Empresa</strong>, <strong>Responsable empresa</strong>, <strong>Slot</strong>, <strong>Día</strong>, <strong>Bloque</strong>, <strong>Hora</strong>, <strong>Mesa</strong>, <strong>Submesa</strong>, <strong>Sponsor</strong>, <strong>Tipo Sponsor</strong>, <strong>Tipo Match</strong>, <strong>Notas</strong>. Todas se importan y conservan.
            </p>
            <label className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-xs font-bold text-uppercase-wide cursor-pointer hover:bg-muted">
              <Upload className="h-4 w-4" />
              {fileName || "Elegir archivo .xlsx"}
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            </label>
            {fileName && <span className="ml-2 text-xs text-muted-foreground"><FileSpreadsheet className="inline h-3 w-3 mr-1" />{rows.length} filas detectadas</span>}
          </div>

          {parseError && (
            <div className="rounded-md border border-destructive bg-destructive/10 text-destructive p-3 text-xs flex gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" /><span>{parseError}</span>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div>
                <label className="text-[10px] text-uppercase-wide text-muted-foreground">Fechas reales para cada día del Excel</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {Array.from({ length: maxDia }, (_, i) => i + 1).map((d) => (
                    <div key={d} className="flex items-center gap-2 rounded-md border border-border bg-input px-3 py-2">
                      <span className="text-xs font-bold w-12">Día {d}</span>
                      <input type="date" value={dayDates[d] ?? ""} onChange={(e) => setDayDates((p) => ({ ...p, [d]: e.target.value }))} className="flex-1 bg-transparent text-xs" />
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} />
                Reemplazar todas las reuniones existentes del evento antes de importar
              </label>
            </>
          )}

          {result && (
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {result.imported} / {result.total} reuniones importadas
              </div>
              {result.errors.length > 0 && (
                <div className="text-xs">
                  <div className="font-bold text-warning mb-1">{result.errors.length} fila(s) con problemas:</div>
                  <ul className="max-h-40 overflow-y-auto space-y-1 text-muted-foreground">
                    {result.errors.slice(0, 50).map((e, i) => (
                      <li key={i}>• {e.row > 0 ? `Fila ${e.row}: ` : ""}{e.reason}</li>
                    ))}
                    {result.errors.length > 50 && <li>… y {result.errors.length - 50} más</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-5">
          <button onClick={onClose} className="flex-1 rounded-md border border-border py-2.5 text-sm font-bold text-uppercase-wide">Cerrar</button>
          <button onClick={submit} disabled={busy || !rows.length || !!result} className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
            {busy ? "Importando…" : `Importar ${rows.length} reuniones`}
          </button>
        </div>
      </div>
    </div>
  );
}
