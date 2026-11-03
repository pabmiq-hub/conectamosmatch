import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Heart, Trophy } from "lucide-react";
import type { ScoreRow } from "@/lib/reto";
import { adminSetWinners, validateWinners, winnerCandidates, type RetoConfig } from "@/lib/reto-admin";

export function RetoWinnersAdmin({ eventId, cfg, rows, onSaved }: { eventId: string; cfg: RetoConfig; rows: ScoreRow[]; onSaved: () => void }) {
  const [superId, setSuperId] = useState<string>(cfg.superconector_user_id ?? "");
  const [almaId, setAlmaId] = useState<string>(cfg.alma_user_id ?? "");
  const [note, setNote] = useState(cfg.awards_note ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSuperId(cfg.superconector_user_id ?? "");
    setAlmaId(cfg.alma_user_id ?? "");
    setNote(cfg.awards_note ?? "");
  }, [cfg.superconector_user_id, cfg.alma_user_id, cfg.awards_note]);

  const base = useMemo(() => winnerCandidates(rows), [rows]);
  const effSuper = superId || (base.superTop.length === 1 ? base.superTop[0].user_id : "");
  const alma = useMemo(() => winnerCandidates(rows, effSuper || null), [rows, effSuper]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.user_id, r])), [rows]);
  const final = cfg.is_closed;

  const save = async (clear = false) => {
    const s = clear ? null : effSuper || null;
    const a = clear ? null : almaId || (alma.almaTop.length === 1 ? alma.almaTop[0].user_id : null);
    const err = validateWinners(rows, s, a);
    if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      await adminSetWinners(eventId, s, a, clear ? "" : note);
      toast.success(clear ? "Ganadores borrados" : "Ganadores registrados");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const label = (r: ScoreRow, unit: "connections" | "points") =>
    `${r.display_name}${r.company_name ? ` · ${r.company_name}` : ""} — ${r[unit]} ${unit === "connections" ? "conexiones" : "puntos"}`;

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="text-xs font-bold text-uppercase-wide">{final ? "Ganadores (resultados congelados)" : "Líderes provisionales"}</div>
      {!final && <p className="text-xs text-muted-foreground">Los premios se confirman después de cerrar el Reto.</p>}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-uppercase-wide text-primary"><Trophy className="h-3.5 w-3.5" /> Superconector</div>
          {base.superTop.length === 0 && <div className="text-sm text-muted-foreground">Nadie tiene conexiones aún</div>}
          {base.superTop.length === 1 && <div className="text-sm font-bold">{label(base.superTop[0], "connections")}</div>}
          {base.superTie && (
            <>
              <div className="text-xs font-bold text-destructive">Empate en primer lugar ({base.superTop.length} personas)</div>
              {final && (
                <select value={superId} onChange={(e) => { setSuperId(e.target.value); setAlmaId(""); }} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
                  <option value="">Elegir desempate…</option>
                  {base.superTop.map((r) => <option key={r.user_id} value={r.user_id}>{label(r, "connections")}</option>)}
                </select>
              )}
              {!final && <ul className="text-xs">{base.superTop.map((r) => <li key={r.user_id}>{label(r, "connections")}</li>)}</ul>}
            </>
          )}
        </div>

        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-uppercase-wide text-primary"><Heart className="h-3.5 w-3.5" /> Alma Conectamos</div>
          {!effSuper && base.superTie && <div className="text-sm text-muted-foreground">Primero resuelve el empate del Superconector</div>}
          {effSuper && alma.almaTop.length === 0 && <div className="text-sm text-muted-foreground">Nadie más tiene puntos</div>}
          {alma.almaTop.length === 1 && <div className="text-sm font-bold">{label(alma.almaTop[0], "points")}</div>}
          {alma.almaTie && (
            <>
              <div className="text-xs font-bold text-destructive">Empate en primer lugar ({alma.almaTop.length} personas)</div>
              {final ? (
                <select value={almaId} onChange={(e) => setAlmaId(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm">
                  <option value="">Elegir desempate…</option>
                  {alma.almaTop.map((r) => <option key={r.user_id} value={r.user_id}>{label(r, "points")}</option>)}
                </select>
              ) : <ul className="text-xs">{alma.almaTop.map((r) => <li key={r.user_id}>{label(r, "points")}</li>)}</ul>}
            </>
          )}
          <div className="text-[10px] text-muted-foreground">No puede ser la misma persona que el Superconector.</div>
        </div>
      </div>

      {final && (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            placeholder="Cómo se ha resuelto el desempate (si lo hubo). Queda registrado."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          {cfg.awards_at && (
            <div className="rounded-lg bg-muted p-3 text-xs">
              <b>Registrado:</b> Superconector — {byId.get(cfg.superconector_user_id ?? "")?.display_name ?? "—"} · Alma Conectamos — {byId.get(cfg.alma_user_id ?? "")?.display_name ?? "—"}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {cfg.awards_at && (
              <button disabled={busy} onClick={() => save(true)} className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-accent disabled:opacity-50">Borrar</button>
            )}
            <button disabled={busy} onClick={() => save(false)} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-uppercase-wide text-primary-foreground disabled:opacity-50">
              Registrar ganadores
            </button>
          </div>
        </>
      )}
    </section>
  );
}
