import { useEffect, useMemo, useState } from "react";
import { X, Heart, Users, UserCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listEmpresaResponsables, likeEmpresaAccount } from "@/lib/admin-users.functions";
import { toast } from "sonner";

type Mode = "choose" | "selective";

export function EmpresaLikeModal({
  empresaUserId, empresaName, eventId, accountLabel = "empresa", onClose, onDone,
}: {
  empresaUserId: string; empresaName: string; eventId: string | null; accountLabel?: "empresa" | "solución"; onClose: () => void; onDone?: () => void;
}) {
  const fetchResp = useServerFn(listEmpresaResponsables);
  const like = useServerFn(likeEmpresaAccount);
  const [mode, setMode] = useState<Mode>("choose");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [responsables, setResponsables] = useState<{ id: string; full_name: string | null; email: string | null; account_role: string; cargo?: string | null }[]>([]);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchResp({ data: { empresaUserId } }).then(async (r) => {
      const resp = r.responsables as any[];
      const existingSet = new Set(r.myExistingLikes);
      const eligible = resp.filter((x) => !existingSet.has(x.id)).map((x) => x.id);
      // Auto-like when there is exactly one eligible responsable — skip the banner
      if (eligible.length === 1) {
        try {
          const res = await like({ data: { responsableIds: eligible, eventId } });
          toast.success(`💛 Like enviado a ${empresaName}`);
          onDone?.();
        } catch (e: any) {
          toast.error(e?.message ?? "Error al dar like");
        }
        onClose();
        return;
      }
      setResponsables(resp);
      setExisting(existingSet);
      setLoading(false);
    }).catch((e: any) => { toast.error(e?.message ?? "Error"); onClose(); });
  }, [empresaUserId]);

  const eligibleIds = useMemo(() => responsables.filter((r) => !existing.has(r.id)).map((r) => r.id), [responsables, existing]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function doLike(ids: string[]) {
    if (!ids.length) { toast.info("Ya has dado like a todos los responsables disponibles"); return; }
    setBusy(true);
    try {
      const res = await like({ data: { responsableIds: ids, eventId } });
      toast.success(`💛 ${res.count} like(s) enviados a ${empresaName}`);
      onDone?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al dar like");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-bold text-uppercase-wide flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" /> {empresaName}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Cargando responsables…</div>
        ) : mode === "choose" ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Esta {accountLabel} tiene <span className="font-bold text-foreground">{responsables.length}</span> responsable(s) activo(s). ¿Cómo quieres mostrar tu interés?
            </p>
            <button
              onClick={() => doLike(eligibleIds)}
              disabled={busy || eligibleIds.length === 0}
              className="w-full text-left rounded-xl border border-primary bg-primary/10 p-4 hover:bg-primary/20 transition disabled:opacity-50"
            >
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold text-sm">Me interesa esta {accountLabel}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Da like a todos los responsables activos ({eligibleIds.length} pendientes). Si alguno responde, se crea un match a nivel cuenta.
                  </div>
                </div>
              </div>
            </button>
            <button
              onClick={() => setMode("selective")}
              disabled={busy || responsables.length === 0}
              className="w-full text-left rounded-xl border border-border bg-background p-4 hover:bg-muted transition disabled:opacity-50"
            >
              <div className="flex items-start gap-3">
                <UserCheck className="h-5 w-5 text-foreground mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold text-sm">Elegir responsables</div>
                  <div className="text-[11px] text-muted-foreground mt-1">Selecciona individualmente a quién quieres dar like.</div>
                </div>
              </div>
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">Selecciona los responsables a los que quieres dar like:</p>
            <ul className="flex-1 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {responsables.map((r) => {
                const already = existing.has(r.id);
                const checked = selected.has(r.id);
                return (
                  <li key={r.id} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${already ? "opacity-50" : "cursor-pointer hover:bg-muted"}`} onClick={() => !already && toggle(r.id)}>
                    <input
                      type="checkbox"
                      checked={already || checked}
                      disabled={already}
                      onChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 accent-primary cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-xs truncate">{r.full_name ?? r.email}</div>
                      {r.cargo && <div className="text-[10px] text-foreground/70 truncate">{r.cargo}</div>}
                      <div className="text-[10px] text-muted-foreground truncate">{r.email}</div>
                    </div>
                    {r.account_role === "owner" && <span className="text-[9px] font-bold text-primary rounded-full bg-primary/10 px-2 py-0.5 text-uppercase-wide">Admin</span>}
                    {already && <span className="text-[9px] text-success text-uppercase-wide font-bold">Like enviado</span>}
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setMode("choose")} className="flex-1 rounded-md border border-border py-2.5 text-sm font-bold text-uppercase-wide">Atrás</button>
              <button onClick={() => doLike(Array.from(selected))} disabled={busy || selected.size === 0} className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
                {busy ? "Enviando…" : `Dar like (${selected.size})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
