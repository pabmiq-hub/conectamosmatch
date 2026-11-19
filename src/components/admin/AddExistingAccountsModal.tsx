import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Search } from "lucide-react";
import { toast } from "sonner";
import { addAccountsToEvent, listAccountsForEvent } from "@/lib/admin-registrations.functions";

type Acc = { id: string; name: string; kind: "empresa" | "sponsor"; inEvent: boolean };

/** Lets the superadmin bring accounts that already exist into this event. */
export function AddExistingAccountsModal({ eventId, onClose, onDone }: { eventId: string; onClose: () => void; onDone: () => void }) {
  const list = useServerFn(listAccountsForEvent);
  const add = useServerFn(addAccountsToEvent);
  const [accounts, setAccounts] = useState<Acc[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<"empresa" | "sponsor">("empresa");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    list({ data: { event_id: eventId } }).then((r) => setAccounts(r.accounts)).catch((e) => { toast.error(e?.message ?? "Error"); setAccounts([]); });
  }, [eventId]);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (accounts ?? []).filter((a) => a.kind === kind && !a.inEvent && (!t || a.name.toLowerCase().includes(t)));
  }, [accounts, kind, q]);

  const toggle = (id: string) => setPicked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function submit() {
    if (!picked.size) return;
    setBusy(true);
    try {
      const r = await add({ data: { event_id: eventId, account_ids: [...picked] } });
      toast.success(`${picked.size} cuentas añadidas (${r.added} personas inscritas)`);
      onDone(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-display text-sm font-bold text-uppercase-wide">Añadir cuentas existentes</h2>
          <button onClick={onClose} aria-label="Cerrar" className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-xs text-muted-foreground">Se inscribirán en este evento todas las personas activas de cada cuenta. Solo aparecen las cuentas que aún no participan.</p>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {(["empresa", "sponsor"] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={`px-3 py-1.5 text-xs font-bold text-uppercase-wide ${kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{k === "empresa" ? "Empresas" : "Soluciones"}</button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cuenta…" className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {accounts === null ? <div className="py-8 text-center text-xs text-muted-foreground">Cargando…</div> :
            visible.length === 0 ? <div className="py-8 text-center text-xs text-muted-foreground">No hay cuentas pendientes de añadir.</div> :
            visible.map((a) => (
              <label key={a.id} className="flex items-center gap-3 border-b border-border py-2 text-sm cursor-pointer">
                <input type="checkbox" checked={picked.has(a.id)} onChange={() => toggle(a.id)} />
                <span className="truncate">{a.name}</span>
              </label>
            ))}
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground">{picked.size} seleccionadas</span>
          <button onClick={submit} disabled={busy || !picked.size} className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-uppercase-wide text-primary-foreground disabled:opacity-50">{busy ? "Añadiendo…" : "Añadir al evento"}</button>
        </div>
      </div>
    </div>
  );
}
