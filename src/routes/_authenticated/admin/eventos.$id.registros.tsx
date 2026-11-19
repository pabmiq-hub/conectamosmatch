import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Users, Download, Trash2, Upload, UserPlus, KeyRound, Mail, Send } from "lucide-react";
import { ImportUsersModal } from "@/components/admin/ImportUsersModal";
import { AddExistingAccountsModal } from "@/components/admin/AddExistingAccountsModal";
import { useAdminEvent } from "@/hooks/use-admin-event";
import { toast } from "sonner";
import { listRegistrations, deleteRegistration } from "@/lib/admin-registrations.functions";
import { setPasswordAndMaybeSend, sendEventCredentials } from "@/lib/credentials-email.functions";

export const Route = createFileRoute("/_authenticated/admin/eventos/$id/registros")({
  component: AdminRegistros,
});

function AdminRegistros() {
  const { id } = Route.useParams();
  const list = useServerFn(listRegistrations);
  const setPwd = useServerFn(setPasswordAndMaybeSend);
  const sendAll = useServerFn(sendEventCredentials);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [alsoSend, setAlsoSend] = useState(true);

  async function sendOne(r: any) {
    if (!r.user_id) return toast.error("Esta inscripción no tiene cuenta asociada");
    if (!window.confirm(`Se generará una nueva contraseña para ${r.attendee_name ?? r.attendee_email} y se le enviará por email. ¿Continuar?`)) return;
    setBusyId(r.id);
    const res = await setPwd({ data: { userId: r.user_id, send: true, event_id: id } });
    setBusyId(null);
    res.ok ? toast.success(`Claves enviadas a ${res.email}`) : toast.error(res.error);
  }

  async function saveEdit() {
    if (newPwd.length < 8) return toast.error("Mínimo 8 caracteres");
    setBusyId(editing.id);
    const res = await setPwd({ data: { userId: editing.user_id, password: newPwd, send: alsoSend, event_id: id } });
    setBusyId(null);
    if (res.ok) { toast.success(alsoSend ? `Contraseña guardada y enviada a ${res.email}` : "Contraseña guardada"); setEditing(null); }
    else toast.error(res.error);
  }

  async function onSendAll() {
    const n = rows.filter((r) => r.user_id && r.status !== "cancelled").length;
    if (!window.confirm(`Se generará una nueva contraseña para ${n} participantes y se les enviará por email. Sus contraseñas actuales dejarán de funcionar. ¿Continuar?`)) return;
    setSendingAll(true);
    try {
      const res = await sendAll({ data: { event_id: id } });
      if (res.failed.length) toast.error(`${res.sent}/${res.total} enviados. Error: ${res.failed[0].error}`, { duration: 10000 });
      else toast.success(`${res.sent}/${res.total} correos enviados`);
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setSendingAll(false); }
  }
  const del = useServerFn(deleteRegistration);
  const [rows, setRows] = useState<any[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const { eventId, setEventId, ready } = useAdminEvent();
  useEffect(() => { if (ready && eventId !== id) setEventId(id); }, [ready, id]);

  async function load() {
    try { const r = await list({ data: { event_id: id } }); setRows(r.registrations); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  useEffect(() => { load(); }, [id]);

  function exportCSV() {
    const header = ["Nombre", "Empresa", "Email", "Rol", "Cargo", "Estado", "Check-in", "Registrado"];
    const lines = [header.join(",")].concat(
      rows.map((r) => [r.attendee_name, r.attendee_company, r.attendee_email, r.role_at_event, r.attendee_role_title, r.status, r.checked_in_at ?? "", r.registered_at]
        .map((v) => `"${(v ?? "").toString().replaceAll('"', '""')}"`).join(",")),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `registros-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Participantes" subtitle={`Total: ${rows.length}`} right={
        <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-bold text-uppercase-wide text-primary-foreground"><Upload className="h-3 w-3" /> Subir participantes (Excel)</button>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide"><UserPlus className="h-3 w-3" /> Añadir cuentas existentes</button>
        <button onClick={onSendAll} disabled={sendingAll || rows.length === 0} className="inline-flex items-center gap-2 rounded-md border border-primary/50 px-3 py-2 text-xs font-bold text-uppercase-wide text-primary disabled:opacity-50"><Send className="h-3 w-3" /> {sendingAll ? "Enviando…" : "Enviar claves a todos"}</button>
        <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide"><Download className="h-3 w-3" /> Exportar CSV</button>
        </div>
      } />
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="font-display text-sm font-bold text-uppercase-wide">Editar contraseña</h2>
              <p className="text-xs text-muted-foreground mt-1">{editing.attendee_name} · {editing.attendee_email}</p>
            </div>
            <input type="text" autoFocus value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Nueva contraseña (mín. 8)" className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={alsoSend} onChange={(e) => setAlsoSend(e.target.checked)} /> Enviarle la nueva contraseña por email</label>
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-md border border-border py-2 text-xs font-bold text-uppercase-wide">Cancelar</button>
              <button onClick={saveEdit} disabled={busyId === editing.id} className="flex-1 rounded-md bg-primary py-2 text-xs font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">{busyId === editing.id ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
      {showAdd && <AddExistingAccountsModal eventId={id} onClose={() => setShowAdd(false)} onDone={load} />}
      {showImport && <ImportUsersModal defaultEventId={id} onClose={() => setShowImport(false)} onDone={load} />}
      {rows.length === 0 ? <EmptyState icon={Users} title="Sin participantes" hint="Pulsa «Subir participantes (Excel)» o «Añadir cuentas existentes» para inscribirlos en este evento. Solo quienes estén aquí aparecerán en las selecciones, matches y reuniones del evento." /> : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] text-uppercase-wide text-muted-foreground"><tr>
              <th className="px-4 py-3 text-left">Nombre</th><th className="px-4 py-3 text-left">Empresa</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Rol</th><th className="px-4 py-3 text-left">Estado</th><th />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-xs">{r.attendee_name}</td>
                  <td className="px-4 py-3 text-xs">{r.attendee_company}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.attendee_email}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{r.role_at_event}</span></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide bg-muted`}>{r.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button disabled={!r.user_id || busyId === r.id} onClick={() => { setEditing(r); setNewPwd(""); setAlsoSend(true); }} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-40" title="Editar contraseña"><KeyRound className="h-4 w-4" /></button>
                    <button disabled={!r.user_id || busyId === r.id} onClick={() => sendOne(r)} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-40" title="Enviar claves por email"><Mail className="h-4 w-4" /></button>
                    <button onClick={async () => {
                      if (!window.confirm("¿Eliminar inscripción?")) return;
                      try { await del({ data: { id: r.id } }); toast.success("Eliminada"); load(); }
                      catch (e: any) { toast.error(e?.message ?? "Error"); }
                    }} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
