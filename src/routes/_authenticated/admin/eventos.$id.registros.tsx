import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Users, Download, Trash2, Upload, UserPlus, KeyRound, Mail, Send, CalendarClock, Pencil } from "lucide-react";
import { SortToggle, type SortDir } from "@/components/dashboard/SortToggle";
import {
  filterAndSortRegistrations,
  roleCounts,
  roleLabel,
  type RoleFilter,
  type SortField,
} from "@/lib/registration-list";
import { ImportUsersModal } from "@/components/admin/ImportUsersModal";
import { NewUserModal } from "@/components/admin/NewUserModal";
import { EditUserModal } from "@/components/admin/EditUserModal";
import { AddExistingAccountsModal } from "@/components/admin/AddExistingAccountsModal";
import { useAdminEvent } from "@/hooks/use-admin-event";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { AvailabilityEditor } from "@/components/dashboard/AvailabilityEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listRegistrations, deleteRegistration, deleteRegistrationsBulk } from "@/lib/admin-registrations.functions";
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

  function downloadCredentialsExcel(results: any[]) {
    if (!results?.length) return;
    const fmt = (iso: string) => new Date(iso).toLocaleString("es-ES", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const data = results.map((x) => {
      const r = rows.find((row) => row.user_id === x.user_id) ?? {};
      return {
        "Empresa / Solución": r.attendee_company ?? "",
        "Nombre": x.name || r.attendee_name || "",
        "Email": x.email,
        "Tipo": r.role_at_event ? roleLabel(r) : "",
        "Cargo": r.attendee_role_title ?? "",
        "Contraseña": x.password ?? "(sin cambios)",
        "Estado envío": x.status,
        "Fecha de envío": fmt(x.sent_at),
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Claves");
    const slug = "evento".toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    XLSX.writeFile(wb, `claves-${slug}-${id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function onSendAll() {
    const n = rows.filter((r) => r.user_id && r.status !== "cancelled").length;
    if (!window.confirm(`Se generará una nueva contraseña para ${n} participantes y se les enviará por email. Sus contraseñas actuales dejarán de funcionar. Al terminar se descargará un Excel con las mismas claves enviadas. ¿Continuar?`)) return;
    setSendingAll(true);
    try {
      const res = await sendAll({ data: { event_id: id } });
      if (res.failed.length) toast.error(`${res.sent}/${res.total} enviados. Error: ${res.failed[0].error}`, { duration: 10000 });
      else toast.success(`${res.sent}/${res.total} correos enviados`);
      downloadCredentialsExcel(res.results);
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setSendingAll(false); }
  }
  const del = useServerFn(deleteRegistration);
  const delBulk = useServerFn(deleteRegistrationsBulk);
  const [bulkRole, setBulkRole] = useState<RoleFilter | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  async function confirmBulkDelete() {
    if (!bulkRole) return;
    setBulkBusy(true);
    try {
      const r = await delBulk({ data: { event_id: id, role: bulkRole } });
      toast.success(`${r.deleted} participantes quitados del evento`);
      setBulkRole(null); load();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setBulkBusy(false); }
  }
  const [availFor, setAvailFor] = useState<any>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [role, setRole] = useState<RoleFilter>("all");
  const [sortField, setSortField] = useState<SortField>("company");
  const [dir, setDir] = useState<SortDir>("asc");
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const { eventId, setEventId, ready } = useAdminEvent();
  useEffect(() => { if (ready && eventId !== id) setEventId(id); }, [ready, id]);

  async function load() {
    try { const r = await list({ data: { event_id: id } }); setRows(r.registrations); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  useEffect(() => { load(); }, [id]);

  const counts = useMemo(() => roleCounts(rows), [rows]);

  const visible = useMemo(
    () => filterAndSortRegistrations(rows, { role, field: sortField, dir }),
    [rows, role, sortField, dir],
  );

  function exportCSV() {
    const header = ["Nombre", "Empresa", "Email", "Rol", "Cargo", "Estado", "Check-in", "Registrado"];
    const lines = [header.join(",")].concat(
      visible.map((r) => [r.attendee_name, r.attendee_company, r.attendee_email, r.role_at_event, r.attendee_role_title, r.status, r.checked_in_at ?? "", r.registered_at]
        .map((v) => `"${(v ?? "").toString().replaceAll('"', '""')}"`).join(",")),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `registros-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <Dialog open={!!bulkRole} onOpenChange={(o) => !o && !bulkBusy && setBulkRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bulkRole === "empresa" ? `Borrar las ${counts.empresa} empresas` : bulkRole === "sponsor" ? `Borrar las ${counts.sponsor} soluciones` : `Borrar los ${counts.all} participantes`}</DialogTitle>
            <DialogDescription>Se quitarán de este evento. Sus cuentas no se eliminan y podrás volver a añadirlas con «Añadir cuentas existentes». Las selecciones, matches y reuniones ya creadas no se borran.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button disabled={bulkBusy} onClick={() => setBulkRole(null)} className="rounded-md border border-border px-3 py-2 text-xs font-bold">Cancelar</button>
            <button disabled={bulkBusy} onClick={confirmBulkDelete} className="rounded-md bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-50">{bulkBusy ? "Borrando…" : "Sí, borrar"}</button>
          </div>
        </DialogContent>
      </Dialog>
      <PageHeader title="Participantes" subtitle={`Total: ${rows.length}`} right={
        <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-bold text-uppercase-wide text-primary-foreground"><Upload className="h-3 w-3" /> Subir participantes (Excel)</button>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 rounded-md border border-primary/50 px-3 py-2 text-xs font-bold text-uppercase-wide text-primary"><UserPlus className="h-3 w-3" /> Nuevo participante</button>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide"><UserPlus className="h-3 w-3" /> Añadir cuentas existentes</button>
        <button onClick={onSendAll} disabled={sendingAll || rows.length === 0} className="inline-flex items-center gap-2 rounded-md border border-primary/50 px-3 py-2 text-xs font-bold text-uppercase-wide text-primary disabled:opacity-50"><Send className="h-3 w-3" /> {sendingAll ? "Enviando…" : "Enviar claves a todos"}</button>
        <select value="" disabled={rows.length === 0} onChange={(e) => e.target.value && setBulkRole(e.target.value as RoleFilter)} className="rounded-md border border-destructive/50 bg-card px-3 py-2 text-xs font-bold text-uppercase-wide text-destructive disabled:opacity-50">
          <option value="">Borrar…</option>
          <option value="all">Todos los participantes ({counts.all})</option>
          <option value="empresa">Todas las empresas ({counts.empresa})</option>
          <option value="sponsor">Todas las soluciones ({counts.sponsor})</option>
        </select>
        <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide"><Download className="h-3 w-3" /> Exportar CSV</button>
        </div>
      } />
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
          <div className="inline-flex overflow-hidden rounded-md border border-border">
            {([
              { id: "all" as RoleFilter, label: "Todos" },
              { id: "empresa" as RoleFilter, label: "Empresas" },
              { id: "sponsor" as RoleFilter, label: "Soluciones" },
            ]).map((f, i) => (
              <button key={f.id} type="button" onClick={() => setRole(f.id)}
                className={`px-3 py-1.5 text-[11px] font-bold text-uppercase-wide ${i > 0 ? "border-l border-border" : ""} ${role === f.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                {f.label} <span className="opacity-70">({counts[f.id]})</span>
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="text-[11px] font-bold text-uppercase-wide text-muted-foreground">Ordenar por</span>
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              {([
                { id: "company" as SortField, label: "Empresa" },
                { id: "name" as SortField, label: "Nombre" },
              ]).map((f, i) => (
                <button key={f.id} type="button" onClick={() => setSortField(f.id)}
                  className={`px-3 py-1.5 text-[11px] font-bold text-uppercase-wide ${i > 0 ? "border-l border-border" : ""} ${sortField === f.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <SortToggle value={dir} onChange={setDir} label="Orden alfabético" />
          </div>
          <span className="ml-auto text-[11px] font-bold text-uppercase-wide text-muted-foreground">
            {visible.length === rows.length ? `${rows.length} participantes` : `${visible.length} de ${rows.length}`}
          </span>
        </div>
      )}
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
      {editUserId && <EditUserModal userId={editUserId} onClose={() => setEditUserId(null)} onSaved={load} />}
      {showNew && <NewUserModal eventId={id} onClose={() => setShowNew(false)} onCreated={load} />}
      {showAdd && <AddExistingAccountsModal eventId={id} onClose={() => setShowAdd(false)} onDone={load} />}
      {showImport && <ImportUsersModal defaultEventId={id} onClose={() => setShowImport(false)} onDone={load} />}
      {rows.length === 0 ? <EmptyState icon={Users} title="Sin participantes" hint="Pulsa «Subir participantes (Excel)» o «Añadir cuentas existentes» para inscribirlos en este evento. Solo quienes estén aquí aparecerán en las selecciones, matches y reuniones del evento." /> : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] text-uppercase-wide text-muted-foreground"><tr>
              <th className="px-4 py-3 text-left">Nombre</th><th className="px-4 py-3 text-left">Empresa</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Rol</th><th className="px-4 py-3 text-left">Estado</th><th />
            </tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-xs">{r.attendee_name}</td>
                  <td className="px-4 py-3 text-xs">{r.attendee_company}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.attendee_email}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{roleLabel(r)}</span></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide bg-muted`}>{r.status}</span></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button disabled={!r.user_id} onClick={() => setEditUserId(r.user_id)} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-40" title="Editar participante"><Pencil className="h-4 w-4" /></button>
                    <button disabled={!r.user_id || busyId === r.id} onClick={() => { setEditing(r); setNewPwd(""); setAlsoSend(true); }} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-40" title="Editar contraseña"><KeyRound className="h-4 w-4" /></button>
                    <button disabled={!r.user_id} onClick={() => setAvailFor(r)} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-40" title="Disponibilidad y restricciones de agenda"><CalendarClock className="h-4 w-4" /></button>
                    <button disabled={!r.user_id || busyId === r.id} onClick={() => sendOne(r)} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-40" title="Enviar claves por email"><Mail className="h-4 w-4" /></button>
                    <button onClick={async () => {
                      if (!window.confirm("¿Eliminar inscripción?")) return;
                      try { await del({ data: { id: r.id } }); toast.success("Eliminada"); load(); }
                      catch (e: any) { toast.error(e?.message ?? "Error"); }
                    }} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr className="border-t border-border">
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    No hay participantes de este tipo en el evento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {availFor && (
        <Dialog open onOpenChange={(o) => { if (!o) setAvailFor(null); }}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Disponibilidad · {availFor.attendee_name}</DialogTitle>
              <DialogDescription>{availFor.attendee_company} — marca los días que asiste, las franjas en las que no puede y su máximo de reuniones.</DialogDescription>
            </DialogHeader>
            <AvailabilityEditor eventId={id} targetUserId={availFor.user_id} onSaved={() => setAvailFor(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
