import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, ChevronDown, Wrench } from "lucide-react";
import { toast } from "sonner";
import { listAccountHealth, fixAccountResponsable, type AccountHealthRow } from "@/lib/admin-account-health.functions";

const ISSUE_LABEL: Record<string, string> = {
  sin_responsable: "Sin responsable asignado",
  responsable_roto: "Responsable inexistente",
  sin_miembros: "Ningún usuario vinculado",
};

export function AccountHealthPanel() {
  const list = useServerFn(listAccountHealth);
  const fix = useServerFn(fixAccountResponsable);
  const [data, setData] = useState<{ total: number; accounts: AccountHealthRow[]; orphanRegistrations: any[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try { setData(await list()); } catch (e: any) { toast.error(e?.message ?? "Error al comprobar cuentas"); }
  }
  useEffect(() => { load(); }, []);

  async function repair(r: AccountHealthRow) {
    if (!r.suggested_user_id) return;
    setBusy(r.account_id);
    try {
      await fix({ data: { account_id: r.account_id, kind: r.kind, user_id: r.suggested_user_id } });
      toast.success(`${r.suggested_name} es ahora responsable de ${r.company_name}`);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Error"); } finally { setBusy(null); }
  }

  async function repairAll() {
    if (!data) return;
    for (const r of data.accounts.filter((a) => a.suggested_user_id && !a.issues.includes("sin_miembros"))) await repair(r);
  }

  if (!data) return null;
  const n = data.accounts.length + data.orphanRegistrations.length;
  if (n === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <CheckCircle2 className="h-4 w-4 text-primary" /> Las {data.total} cuentas tienen un responsable vinculado.
      </div>
    );
  }
  const fixable = data.accounts.filter((a) => a.suggested_user_id && !a.issues.includes("sin_miembros")).length;
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        {data.accounts.length} cuenta{data.accounts.length === 1 ? "" : "s"} sin responsable vinculado
        {data.orphanRegistrations.length > 0 && ` · ${data.orphanRegistrations.length} inscripción(es) sin usuario`}
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-4 py-3">
          {fixable > 0 && (
            <button onClick={repairAll} disabled={!!busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-bold text-uppercase-wide text-primary-foreground disabled:opacity-50">
              <Wrench className="h-3 w-3" /> Reparar automáticamente ({fixable})
            </button>
          )}
          {data.accounts.map((r) => (
            <div key={r.account_id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
              <span className="text-[10px] font-bold text-uppercase-wide text-muted-foreground">{r.kind === "empresa" ? "Empresa" : "Solución"}</span>
              <span className="font-bold">{r.company_name}</span>
              <span className="text-xs text-destructive">{r.issues.map((i) => ISSUE_LABEL[i]).join(" · ")}</span>
              {r.suggested_user_id && !r.issues.includes("sin_miembros") ? (
                <button onClick={() => repair(r)} disabled={busy === r.account_id} className="ml-auto rounded-md border border-primary/50 px-2 py-1 text-xs font-bold text-primary disabled:opacity-50">
                  Asignar a {r.suggested_name}
                </button>
              ) : (
                <span className="ml-auto text-xs text-muted-foreground">Invita a un responsable desde la cuenta</span>
              )}
            </div>
          ))}
          {data.orphanRegistrations.map((r: any) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
              <span className="text-[10px] font-bold text-uppercase-wide text-muted-foreground">Inscripción</span>
              <span className="font-bold">{r.attendee_company ?? "—"}</span>
              <span>{r.attendee_name ?? r.attendee_email ?? ""}</span>
              <span className="ml-auto text-xs text-destructive">Sin usuario en la plataforma</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
