import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, AlertTriangle, KeyRound, Trash2, Download, Search } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { bulkDeleteUsers, bulkResetPasswords, exportAllUsers } from "@/lib/admin-users.functions";

type Mode = "delete" | "passwords";
type Row = { id: string; name: string; email: string; role: string };

export function BulkUsersModal({ mode, onClose, onDone }: { mode: Mode; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const del = useServerFn(bulkDeleteUsers);
  const reset = useServerFn(bulkResetPasswords);
  const exportFn = useServerFn(exportAllUsers);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .neq("role", "super_admin")
        .order("full_name");
      setRows((data ?? []).map((p: any) => ({ id: p.id, name: p.full_name ?? "(sin nombre)", email: p.email ?? "", role: p.role })));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter((r) => !s || r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s));
  }, [rows, q]);

  const affected = rows.length - keep.size;

  function toggle(id: string) {
    setKeep((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function downloadXlsx(filename: string, sheetName: string, data: any[]) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  }

  async function onConfirmDelete() {
    if (!window.confirm(`Vas a eliminar ${affected} cuentas de forma permanente. ¿Continuar?`)) return;
    setBusy(true);
    try {
      const res = await del({ data: { exceptIds: Array.from(keep) } });
      toast.success(`Eliminadas ${res.deleted} cuentas${res.failed.length ? ` (${res.failed.length} con error)` : ""}`);
      onDone();
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setBusy(false); }
  }

  async function onGeneratePasswords() {
    if (!window.confirm(`Vas a regenerar la contraseña de ${affected} usuarios y se descargará un Excel con las nuevas credenciales. ¿Continuar?`)) return;
    setBusy(true);
    try {
      const { results } = await reset({ data: { exceptIds: Array.from(keep) } });
      const ok = results.filter((r) => r.ok);
      downloadXlsx(`credenciales-${new Date().toISOString().slice(0,10)}.xlsx`, "Credenciales", ok.map((r) => ({
        Nombre: r.full_name, Email: r.email, Rol: r.role, "Nueva contraseña": r.password,
      })));
      toast.success(`${ok.length} contraseñas generadas y exportadas`);
      onDone();
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setBusy(false); }
  }

  async function onExport() {
    setBusy(true);
    try {
      const { rows } = await exportFn({ data: {} as any });
      downloadXlsx(`usuarios-${new Date().toISOString().slice(0,10)}.xlsx`, "Usuarios", rows);
      toast.success(`${rows.length} usuarios exportados`);
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setBusy(false); }
  }

  const isDelete = mode === "delete";
  const accent = isDelete ? "text-destructive" : "text-primary";
  const Icon = isDelete ? Trash2 : KeyRound;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${accent}`} />
            <h2 className="font-display font-bold text-sm">
              {isDelete ? "Borrar usuarios masivamente" : "Generar contraseñas y exportar"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-start gap-2 text-[11px]">
          <AlertTriangle className={`h-4 w-4 ${accent} shrink-0 mt-0.5`} />
          <p className="text-muted-foreground">
            {isDelete
              ? "Marca los usuarios que quieras conservar. El resto serán eliminados permanentemente (incluyendo sus cuentas y responsables si son owners). Los super administradores nunca se eliminan."
              : "Marca los usuarios cuya contraseña quieras conservar. Para el resto se generará una nueva contraseña aleatoria y se descargará un Excel con las credenciales. Los super administradores no se modifican."}
          </p>
        </div>

        <div className="px-4 py-2 border-b border-border flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usuario..." className="w-full rounded-md border border-border bg-card pl-8 pr-3 py-2 text-xs" />
          </div>
          <button onClick={() => setKeep(new Set())} className="text-[10px] font-bold text-uppercase-wide text-muted-foreground hover:text-foreground">Vaciar selección</button>
          <button onClick={() => setKeep(new Set(rows.map((r) => r.id)))} className="text-[10px] font-bold text-uppercase-wide text-muted-foreground hover:text-foreground">Marcar todos</button>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Sin resultados</div>
          ) : (
            filtered.map((r) => (
              <label key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer hover:bg-muted/30">
                <input type="checkbox" checked={keep.has(r.id)} onChange={() => toggle(r.id)} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-xs truncate">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.email} · {r.role}</div>
                </div>
                {keep.has(r.id) && <span className="text-[10px] font-bold text-uppercase-wide text-success">Conservar</span>}
              </label>
            ))
          )}
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground">
            Total: <b>{rows.length}</b> · Conservar: <b>{keep.size}</b> · Afectados: <b className={accent}>{affected}</b>
          </div>
          <div className="flex gap-2">
            {!isDelete && (
              <button onClick={onExport} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide disabled:opacity-50">
                <Download className="h-3.5 w-3.5" /> Exportar sin cambiar
              </button>
            )}
            <button onClick={onClose} className="rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide">Cancelar</button>
            {isDelete ? (
              <button onClick={onConfirmDelete} disabled={busy || affected === 0} className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-2 text-xs font-bold text-uppercase-wide text-destructive-foreground disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" /> Eliminar {affected}
              </button>
            ) : (
              <button onClick={onGeneratePasswords} disabled={busy || affected === 0} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-bold text-uppercase-wide text-primary-foreground disabled:opacity-50">
                <KeyRound className="h-3.5 w-3.5" /> Generar {affected} contraseñas
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
