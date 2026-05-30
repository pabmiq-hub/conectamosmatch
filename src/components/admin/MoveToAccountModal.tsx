import { useEffect, useState } from "react";
import { X, ArrowRightLeft, Search } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listAccounts, moveResponsableToAccount } from "@/lib/admin-users.functions";
import { toast } from "sonner";

export function MoveToAccountModal({ userId, userLabel, currentRole, onClose, onDone }: {
  userId: string; userLabel: string; currentRole: "empresa" | "sponsor"; onClose: () => void; onDone?: () => void;
}) {
  const fetchAccounts = useServerFn(listAccounts);
  const move = useServerFn(moveResponsableToAccount);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [target, setTarget] = useState<string>("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAccounts().then((a) => {
      setAccounts(currentRole === "empresa" ? a.empresas : a.sponsors);
    }).catch(() => {});
  }, []);

  const filtered = accounts.filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase()));

  async function submit() {
    if (!target) return;
    setBusy(true);
    try {
      await move({ data: { userId, targetAccountId: target } });
      toast.success("Responsable movido");
      onDone?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al mover");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-bold text-uppercase-wide flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" /> Mover a otra cuenta
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Mover <span className="font-bold text-foreground">{userLabel}</span> a una cuenta {currentRole} existente. Quedará como <span className="font-bold">responsable</span>. Si era el único admin, otro miembro será promovido automáticamente.
        </p>
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cuenta…" className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm" />
        </div>
        <div className="flex-1 overflow-y-auto rounded-md border border-border divide-y divide-border">
          {filtered.map((a) => (
            <button key={a.id} onClick={() => setTarget(a.id)} className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${target === a.id ? "bg-primary/10 text-primary font-bold" : ""}`}>
              {a.name}
            </button>
          ))}
          {filtered.length === 0 && <div className="p-4 text-xs text-muted-foreground text-center">Sin cuentas</div>}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 rounded-md border border-border py-2.5 text-sm font-bold text-uppercase-wide">Cancelar</button>
          <button onClick={submit} disabled={!target || busy} className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
            {busy ? "Moviendo…" : "Mover"}
          </button>
        </div>
      </div>
    </div>
  );
}
