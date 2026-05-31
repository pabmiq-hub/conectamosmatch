import { useEffect, useState } from "react";
import { X, UserPlus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { inviteResponsable, listAccounts } from "@/lib/admin-users.functions";
import { toast } from "sonner";

type AccountType = "empresa" | "sponsor";

export function InviteResponsableModal({ onClose, onCreated, preset }: { onClose: () => void; onCreated: () => void; preset?: { accountId: string; accountType: AccountType; accountName?: string } }) {
  const invite = useServerFn(inviteResponsable);
  const fetchAccounts = useServerFn(listAccounts);
  const [accounts, setAccounts] = useState<{ empresas: { id: string; name: string }[]; sponsors: { id: string; name: string }[] }>({ empresas: [], sponsors: [] });
  const [accountType, setAccountType] = useState<AccountType>(preset?.accountType ?? "empresa");
  const [accountId, setAccountId] = useState(preset?.accountId ?? "");
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [cargo, setCargo] = useState("");
  const [loading, setLoading] = useState(false);
  const locked = !!preset;

  useEffect(() => { if (!locked) fetchAccounts().then(setAccounts).catch(() => {}); }, []);

  function genPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p + "!2");
  }

  const list = accountType === "empresa" ? accounts.empresas : accounts.sponsors;

  async function submit() {
    if (!accountId || !full_name || !email || password.length < 8) return;
    setLoading(true);
    try {
      await invite({ data: { accountId, accountType, full_name, email, password, phone, cargo } });
      toast.success("Responsable invitado. Comparte las credenciales por tu canal.");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al invitar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-uppercase-wide flex items-center gap-2"><UserPlus className="h-5 w-5" /> Invitar responsable</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Añade un nuevo responsable con login propio a una cuenta existente. Verá la agenda del equipo (solo lectura) y podrá dar likes y matches por su cuenta.</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["empresa","sponsor"] as AccountType[]).map((t) => (
              <button key={t} disabled={locked} onClick={() => { setAccountType(t); setAccountId(""); }} className={`rounded-md border px-3 py-2 text-xs font-bold text-uppercase-wide ${accountType === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"} ${locked ? "opacity-60 cursor-not-allowed" : ""}`}>{t}</button>
            ))}
          </div>
          <div>
            <label className="text-xs text-uppercase-wide text-muted-foreground">Cuenta *</label>
            {locked ? (
              <div className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm">{preset?.accountName ?? "Cuenta seleccionada"}</div>
            ) : (
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
                <option value="">Selecciona…</option>
                {list.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Nombre completo *" value={full_name} onChange={setFullName} />
            <Field label="Email *" type="email" value={email} onChange={setEmail} />
            <div>
              <label className="text-xs text-uppercase-wide text-muted-foreground">Contraseña inicial *</label>
              <div className="flex gap-2 mt-1">
                <input value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm" />
                <button type="button" onClick={genPassword} className="rounded-md border border-border px-3 text-xs font-bold text-uppercase-wide">Generar</button>
              </div>
            </div>
            <Field label="Teléfono" value={phone} onChange={setPhone} />
          </div>
          <button onClick={submit} disabled={loading || !accountId || !full_name || !email || password.length < 8} className="w-full rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
            {loading ? "Invitando…" : "Invitar responsable"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-uppercase-wide text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
    </div>
  );
}
