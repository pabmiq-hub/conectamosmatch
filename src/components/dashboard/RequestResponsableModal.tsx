import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { requestResponsable } from "@/lib/responsable-requests.functions";
import { toast } from "sonner";

export function RequestResponsableModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const submit = useServerFn(requestResponsable);
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cargo, setCargo] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!full_name || !email) return;
    setLoading(true);
    try {
      await submit({ data: { full_name, email, phone, cargo } });
      toast.success("Solicitud enviada. El super administrador la revisará.");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al enviar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-uppercase-wide flex items-center gap-2"><UserPlus className="h-5 w-5" /> Solicitar responsable</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">El super administrador revisará la solicitud y, si la aprueba, asignará una contraseña inicial al responsable.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-uppercase-wide text-muted-foreground">Nombre completo *</label>
            <input value={full_name} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-uppercase-wide text-muted-foreground">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-uppercase-wide text-muted-foreground">Teléfono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-uppercase-wide text-muted-foreground">Cargo *</label>
            <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="p. ej. Directora de RRHH" className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <button onClick={send} disabled={loading || !full_name || !email} className="w-full rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
            {loading ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}
