import { useState } from "react";
import { X, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { approveRequest, type ResponsableRequest } from "@/lib/responsable-requests.functions";
import { toast } from "sonner";

export function ApproveRequestModal({ req, onClose, onDone }: { req: ResponsableRequest; onClose: () => void; onDone: () => void }) {
  const approve = useServerFn(approveRequest);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function gen() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p + "!2");
  }

  async function submit() {
    if (password.length < 8) return;
    setLoading(true);
    try {
      await approve({ data: { id: req.id, password } });
      toast.success("Responsable aprobado. Comparte las credenciales por tu canal.");
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-uppercase-wide flex items-center gap-2"><Check className="h-5 w-5" /> Aprobar responsable</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-2 text-sm mb-4 rounded-md bg-muted/40 p-3">
          <div><span className="text-muted-foreground text-xs">Cuenta:</span> <span className="font-bold">{req.account_name}</span> <span className="text-[10px] text-muted-foreground">({req.account_type})</span></div>
          <div><span className="text-muted-foreground text-xs">Nombre:</span> {req.full_name}</div>
          <div><span className="text-muted-foreground text-xs">Email:</span> {req.email}</div>
          {req.phone && <div><span className="text-muted-foreground text-xs">Teléfono:</span> {req.phone}</div>}
        </div>
        <div>
          <label className="text-xs text-uppercase-wide text-muted-foreground">Contraseña inicial *</label>
          <div className="flex gap-2 mt-1">
            <input value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm" />
            <button type="button" onClick={gen} className="rounded-md border border-border px-3 text-xs font-bold text-uppercase-wide">Generar</button>
          </div>
        </div>
        <button onClick={submit} disabled={loading || password.length < 8} className="mt-4 w-full rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
          {loading ? "Aprobando…" : "Aprobar y crear cuenta"}
        </button>
      </div>
    </div>
  );
}
