import { useState } from "react";
import { X, Shield, Copy, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createSuperAdmin } from "@/lib/admin-users.functions";
import { toast } from "sonner";

export function CreateSuperAdminModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const create = useServerFn(createSuperAdmin);
  const [full_name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function genPwd() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p + "!2");
  }

  async function submit() {
    if (!full_name || !email || password.length < 8) {
      toast.error("Completa nombre, email y contraseña (mín. 8)");
      return;
    }
    setBusy(true);
    try {
      await create({ data: { full_name, email, password } });
      setDone({ email, password });
      toast.success("Super admin creado");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (!done) return;
    navigator.clipboard.writeText(`Email: ${done.email}\nContraseña: ${done.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            <h2 className="font-display text-lg font-bold text-uppercase-wide">Crear super admin</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {done ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Comparte estas credenciales con el nuevo super admin:</p>
            <div className="rounded-md border border-border bg-background p-3 font-mono text-xs space-y-1">
              <div><span className="text-muted-foreground">Email:</span> {done.email}</div>
              <div><span className="text-muted-foreground">Contraseña:</span> {done.password}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={copy} className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border py-2 text-xs font-bold text-uppercase-wide">
                {copied ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
              </button>
              <button onClick={onClose} className="flex-1 rounded-md bg-primary py-2 text-xs font-bold text-primary-foreground text-uppercase-wide">Cerrar</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
              El nuevo super admin podrá gestionar (editar, contraseñas, eliminar) cuentas de usuarios, pero <strong className="text-foreground">no podrá crear nuevas cuentas</strong> ni otros super admins.
            </div>
            <label className="block">
              <span className="text-[10px] text-uppercase-wide font-bold text-muted-foreground">Nombre completo</span>
              <input value={full_name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Nombre Apellidos" />
            </label>
            <label className="block">
              <span className="text-[10px] text-uppercase-wide font-bold text-muted-foreground">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="admin@conectamos.club" />
            </label>
            <label className="block">
              <span className="text-[10px] text-uppercase-wide font-bold text-muted-foreground">Contraseña (mín. 8)</span>
              <div className="mt-1 flex gap-2">
                <input value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono" />
                <button type="button" onClick={genPwd} className="rounded-md border border-border px-3 text-[10px] font-bold text-uppercase-wide">Generar</button>
              </div>
            </label>
            <button onClick={submit} disabled={busy} className="w-full rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
              {busy ? "Creando…" : "Crear super admin"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
