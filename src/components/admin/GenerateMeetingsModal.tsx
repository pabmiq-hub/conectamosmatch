import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Wand2, Check, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { approveMeetingProposal, generateMeetingProposal } from "@/lib/admin-meetings.functions";

type Result = Awaited<ReturnType<typeof generateMeetingProposal>>;
type P = Result["proposals"][number];

const fmtDay = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

export function GenerateMeetingsModal({ eventId, rooms, onClose, onApproved }: { eventId: string; rooms: string[]; onClose: () => void; onApproved: () => void }) {
  const gen = useServerFn(generateMeetingProposal);
  const approve = useServerFn(approveMeetingProposal);
  const [res, setRes] = useState<Result | null>(null);
  const [rows, setRows] = useState<(P & { keep: boolean })[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await gen({ data: { event_id: eventId } });
      setRes(r);
      setRows(r.proposals.map((p) => ({ ...p, keep: true })));
    } catch (e: any) { toast.error(e?.message ?? "Error generando la propuesta"); }
    finally { setBusy(false); }
  }
  useEffect(() => { run(); }, [eventId]);

  const byDay = useMemo(() => {
    const m = new Map<string, { r: (typeof rows)[number]; i: number }[]>();
    rows.forEach((r, i) => { const a = m.get(r.date) ?? []; a.push({ r, i }); m.set(r.date, a); });
    return Array.from(m.entries());
  }, [rows]);

  const conflictIdx = useMemo(() => {
    const seen = new Map<string, number>(); const bad = new Set<number>();
    rows.forEach((r, i) => { if (!r.keep) return; const k = `${r.date}|${r.start}|${r.room}`; if (seen.has(k)) { bad.add(i); bad.add(seen.get(k)!); } else seen.set(k, i); });
    return bad;
  }, [rows]);

  const kept = rows.filter((r) => r.keep);
  const name = (id: string) => res?.accountName[id] ?? "—";
  const person = (id: string) => res?.userName[id] ?? "";

  async function doApprove() {
    if (!kept.length) return toast.error("No hay reuniones seleccionadas");
    if (conflictIdx.size) return toast.error("Hay mesas repetidas en el mismo horario");
    if (!confirm(`Se publicarán ${kept.length} reuniones en la agenda de empresas y soluciones. ¿Continuar?`)) return;
    setBusy(true);
    try {
      const r = await approve({ data: { event_id: eventId, proposals: kept.map(({ keep, ...p }) => ({ ...p, label: p.label ?? null })) } });
      toast.success(`${r.created} reuniones publicadas`);
      onApproved(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Error al publicar"); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-5xl rounded-xl border border-border bg-card p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-uppercase-wide flex items-center gap-2"><Wand2 className="h-5 w-5" /> Propuesta de reuniones (borrador)</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {busy && !res && <p className="text-sm text-muted-foreground py-10 text-center">Calculando propuesta…</p>}

        {res && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Matches sin reunión" value={res.stats.pending} />
              <Stat label="Propuestas" value={res.proposals.length} />
              <Stat label="No caben" value={res.unassigned.length} warn={res.unassigned.length > 0} />
              <Stat label="Seleccionadas" value={kept.length} />
            </div>
            {res.stats.windows === 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">El evento no tiene franjas de reuniones. Añádelas en Eventos → Editar → «Franjas de reuniones por día».</div>
            )}

            {byDay.map(([day, items]) => (
              <div key={day}>
                <h3 className="font-display text-xs font-bold text-uppercase-wide text-muted-foreground mb-2 capitalize">{fmtDay(day)} · {items.length} reuniones</h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground"><tr>
                      <th className="p-2 text-left">✓</th><th className="p-2 text-left">Hora</th><th className="p-2 text-left">Mesa</th><th className="p-2 text-left">Empresa</th><th className="p-2 text-left">Solución</th>
                    </tr></thead>
                    <tbody>
                      {items.map(({ r, i }) => (
                        <tr key={i} className={`border-t border-border ${!r.keep ? "opacity-40" : ""} ${conflictIdx.has(i) ? "bg-destructive/10" : ""}`}>
                          <td className="p-2"><input type="checkbox" checked={r.keep} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, keep: e.target.checked } : x))} /></td>
                          <td className="p-2 font-bold whitespace-nowrap">{r.start}–{r.end}</td>
                          <td className="p-2">
                            <select value={r.room} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, room: e.target.value } : x))} className="rounded border border-border bg-input px-1.5 py-1">
                              {(rooms.length ? rooms : [r.room]).map((rm) => <option key={rm} value={rm}>{rm}</option>)}
                            </select>
                          </td>
                          <td className="p-2"><div className="font-bold">{name(r.empresa_account_id)}</div><div className="text-muted-foreground">{person(r.empresa_user_id)}</div></td>
                          <td className="p-2"><div className="font-bold">{name(r.sponsor_account_id)}</div><div className="text-muted-foreground">{person(r.sponsor_user_id)}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {res.unassigned.length > 0 && (
              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="font-display text-xs font-bold text-uppercase-wide mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> No han cabido ({res.unassigned.length})</h3>
                <ul className="space-y-1 text-xs">
                  {res.unassigned.map((u, i) => (
                    <li key={i}><strong>{name(u.empresa_account_id)}</strong> ↔ <strong>{name(u.sponsor_account_id)}</strong> <span className="text-muted-foreground">— {u.reason}</span></li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={run} disabled={busy} className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-xs font-bold text-uppercase-wide disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Recalcular</button>
              <button onClick={onClose} className="rounded-md border border-border px-4 py-2.5 text-xs font-bold text-uppercase-wide">Descartar</button>
              <button onClick={doApprove} disabled={busy || !kept.length} className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-xs font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
                <Check className="h-4 w-4" /> {busy ? "Publicando…" : `Aprobar y publicar ${kept.length} reuniones`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-destructive/40" : "border-border"} bg-background`}>
      <div className="text-2xl font-display font-bold">{value}</div>
      <div className="text-[10px] text-uppercase-wide text-muted-foreground">{label}</div>
    </div>
  );
}
