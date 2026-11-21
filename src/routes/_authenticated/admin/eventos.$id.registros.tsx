import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Users, Download, Trash2, Upload, UserPlus, KeyRound, Mail, CalendarClock, Pencil, Building2, Sparkles, ChevronRight, List, Layers, GripVertical, Bell } from "lucide-react";
import { SortToggle, type SortDir } from "@/components/dashboard/SortToggle";
import {
  filterAndSortRegistrations, groupRegistrationsByAccount, accountCounts,
  roleCounts,
  roleLabel,
  type RoleFilter,
  type SortField,
} from "@/lib/registration-list";
import { ImportUsersModal } from "@/components/admin/ImportUsersModal";
import { NewUserModal } from "@/components/admin/NewUserModal";
import { EditUserModal } from "@/components/admin/EditUserModal";
import { AccountAdminCrown } from "@/components/admin/AccountAdminCrown";
import { AddExistingAccountsModal } from "@/components/admin/AddExistingAccountsModal";
import { useAdminEvent } from "@/hooks/use-admin-event";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { AvailabilityEditor } from "@/components/dashboard/AvailabilityEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listRegistrations, deleteRegistration, deleteRegistrationsBulk } from "@/lib/admin-registrations.functions";
import { setPasswordAndMaybeSend, sendEventCredentials } from "@/lib/credentials-email.functions";
import { moveUserToAccountOf } from "@/lib/admin-users.functions";
import { listFeaturedSolutions, setFeaturedSolution } from "@/lib/featured-solutions.functions";
import { featuredSolutionIds } from "@/lib/featured-solutions";
import { FeaturedSolutionStar } from "@/components/admin/FeaturedSolutionStar";
import { listAccountSelections } from "@/lib/admin-selections.functions";
import { getParticipantSelections, type SelectionAccount } from "@/lib/participant-selections";
import { ParticipantSelectionCounts, ParticipantSelectionsPanel } from "@/components/admin/ParticipantSelectionsPanel";
import { Button } from "@/components/ui/button";
import { SelectionReminderModal } from "@/components/admin/SelectionReminderModal";

export const Route = createFileRoute("/_authenticated/admin/eventos/$id/registros")({
  head: () => ({ meta: [{ title: "Participantes del evento | Conectamos Match" }, { name: "description", content: "Gestiona empresas, soluciones, participantes y administradores del evento." }, { property: "og:title", content: "Participantes del evento | Conectamos Match" }, { property: "og:description", content: "Cuentas y personas inscritas en el evento." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AdminRegistros,
});

function AdminRegistros() {
  const { id } = Route.useParams();
  const list = useServerFn(listRegistrations);
  const fetchSelections = useServerFn(listAccountSelections);
  const [selectionAccounts, setSelectionAccounts] = useState<SelectionAccount[]>([]);
  const [selectionsLoading, setSelectionsLoading] = useState(true);
  const [selectionsFailed, setSelectionsFailed] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<{ name: string; ids: string[] } | null>(null);
  useEffect(() => { setSelectedAccount(null); }, [id]);
  async function loadSelections() {
    setSelectionsLoading(true);
    setSelectionsFailed(false);
    try {
      const result = await fetchSelections({ data: { event_id: id } });
      setSelectionAccounts([...result.empresas, ...result.sponsors]);
    } catch {
      setSelectionsFailed(true);
    } finally { setSelectionsLoading(false); }
  }
  const selectionsById = useMemo(() => new Map(selectionAccounts.map((account) => [account.account_id, getParticipantSelections(selectionAccounts, [account.account_id])])), [selectionAccounts]);
  function selectionCounts(name: string, ids: string[]) {
    if (!ids.length) return null;
    const detail = ids.length === 1 ? selectionsById.get(ids[0] ?? "") : getParticipantSelections(selectionAccounts, ids);
    return <ParticipantSelectionCounts name={name} detail={detail ?? { outgoing: [], incoming: [], matches: 0 }} loading={selectionsLoading} failed={selectionsFailed} onOpen={() => setSelectedAccount({ name, ids })} />;
  }
  const getFeatured = useServerFn(listFeaturedSolutions);
  const saveFeatured = useServerFn(setFeaturedSolution);
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set());
  const [featuredBusy, setFeaturedBusy] = useState(false);
  async function toggleFeatured(accountId: string) {
    if (featuredBusy) return;
    setFeaturedBusy(true);
    const next = !featuredIds.has(accountId);
    try {
      await saveFeatured({ data: { eventId: id, accountId, featured: next } });
      setFeaturedIds((prev) => { const updated = new Set(prev); next ? updated.add(accountId) : updated.delete(accountId); return updated; });
      toast.success(next ? "Solución destacada en este evento" : "Solución sin destacar");
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar la estrella"); }
    finally { setFeaturedBusy(false); }
  }
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

  function downloadCredentialsExcel(results: any[], group: RoleFilter = "all") {
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
    const slug = (group === "empresa" ? "empresas" : group === "sponsor" ? "soluciones" : "todos").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    XLSX.writeFile(wb, `claves-${slug}-${id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function onSendAll(group: RoleFilter) {
    const n = new Set(rows.filter((r) => r.user_id && r.status !== "cancelled" && (group === "all" || r.role_at_event === group)).map((r) => r.user_id)).size;
    if (!n) { toast.info("No hay participantes de ese tipo"); return; }
    const who = group === "empresa" ? "empresas" : group === "sponsor" ? "soluciones" : "participantes";
    if (!window.confirm(`Se generará una nueva contraseña para ${n} ${who} y se les enviará por email. Sus contraseñas actuales dejarán de funcionar. Al terminar se descargará un Excel con las mismas claves enviadas. ¿Continuar?`)) return;
    setSendingAll(true);
    try {
      const res = await sendAll({ data: { event_id: id, role: group } });
      if (res.failed.length) toast.error(`${res.sent}/${res.total} enviados. Error: ${res.failed[0].error}`, { duration: 10000 });
      else toast.success(`${res.sent}/${res.total} correos enviados`);
      downloadCredentialsExcel(res.results, group);
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setSendingAll(false); }
  }
  async function onDeleteAccount(g: any) {
    const tipo = g.role === "sponsor" ? "la solución" : "la empresa";
    if (!window.confirm(`¿Quitar ${tipo} «${g.company}» y sus ${g.people.length} persona(s) de este evento?\n\nLa cuenta, sus selecciones, matches y reuniones se conservan intactos.`)) return;
    try {
      for (const p of g.people) await del({ data: { id: p.id } });
      toast.success(`«${g.company}» quitada del evento`); load();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  const moveFn = useServerFn(moveUserToAccountOf);
  const [dragged, setDragged] = useState<any | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  async function onDropPerson(g: any) {
    const p = dragged; setDragged(null); setDropKey(null);
    if (!p || g.people.includes(p)) return;
    const target = g.people.find((x: any) => x.user_id);
    if (!p.user_id || !target) return toast.error("Falta el usuario de la persona o de la cuenta destino");
    if (!window.confirm(`¿Mover a ${p.attendee_name ?? p.attendee_email} de «${p.attendee_company ?? ""}» a «${g.company}»?${p.role_at_event !== g.role ? `\n\nPasará de ${p.role_at_event === "sponsor" ? "solución" : "empresa"} a ${g.role === "sponsor" ? "solución" : "empresa"}.` : ""}`)) return;
    try { await moveFn({ data: { userId: p.user_id, targetUserId: target.user_id } }); toast.success(`${p.attendee_name ?? "Persona"} movida a ${g.company}`); load(); }
    catch (e: any) { toast.error(e?.message ?? "Error al mover"); }
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
  const [showReminder, setShowReminder] = useState(false);
  const { eventId, setEventId, ready } = useAdminEvent();
  useEffect(() => { if (ready && eventId !== id) setEventId(id); }, [ready, id]);

  async function load() {
    void loadSelections();
    try {
      const [r, highlights] = await Promise.all([list({ data: { event_id: id } }), getFeatured({ data: { eventId: id } })]);
      setRows(r.registrations);
      setFeaturedIds(featuredSolutionIds(highlights, id));
    }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  useEffect(() => { load(); }, [id]);

  const counts = useMemo(() => roleCounts(rows), [rows]);
  const accCounts = useMemo(() => accountCounts(rows), [rows]);
  const [view, setView] = useState<"grouped" | "list">("grouped");
  const groups = useMemo(
    () => groupRegistrationsByAccount(role === "all" ? rows : rows.filter((r) => r.role_at_event === role), dir),
    [rows, role, dir],
  );

  const visible = useMemo(
    () => filterAndSortRegistrations(rows, { role, field: sortField, dir }),
    [rows, role, sortField, dir],
  );

  function rowActions(r: any) {
    return (<>
                    {r.role_at_event === "sponsor" && r.account_id && r.status !== "cancelled" && <FeaturedSolutionStar name={r.attendee_company ?? "Solución"} featured={featuredIds.has(r.account_id)} busy={featuredBusy} onToggle={() => toggleFeatured(r.account_id)} />}
                    <button disabled={!r.user_id} onClick={() => setEditUserId(r.user_id)} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-40" title="Editar participante"><Pencil className="h-4 w-4" /></button>
                    <button disabled={!r.user_id || busyId === r.id} onClick={() => { setEditing(r); setNewPwd(""); setAlsoSend(true); }} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-40" title="Editar contraseña"><KeyRound className="h-4 w-4" /></button>
                    <button disabled={!r.user_id} onClick={() => setAvailFor(r)} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-40" title="Disponibilidad y restricciones de agenda"><CalendarClock className="h-4 w-4" /></button>
                    <button disabled={!r.user_id || busyId === r.id} onClick={() => sendOne(r)} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-40" title="Enviar claves por email"><Mail className="h-4 w-4" /></button>
                    <button onClick={async () => {
                      if (!window.confirm("¿Quitar a esta persona del evento? Su cuenta y sus interacciones se conservan.")) return;
                      try { await del({ data: { id: r.id } }); toast.success("Quitada del evento"); load(); }
                      catch (e: any) { toast.error(e?.message ?? "Error"); }
                    }} title="Quitar del evento" className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </>);
  }

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
      {selectedAccount && <ParticipantSelectionsPanel name={selectedAccount.name} detail={getParticipantSelections(selectionAccounts, selectedAccount.ids)} onClose={() => setSelectedAccount(null)} />}
      {selectionsFailed && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">No se pudieron cargar las selecciones.<Button variant="outline" size="sm" onClick={() => void loadSelections()}>Reintentar</Button></div>}
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
        <Button variant="outline" size="sm" onClick={() => setShowReminder(true)}><Bell className="h-4 w-4" />Enviar recordatorio</Button>
        <select value="" disabled={sendingAll || rows.length === 0} onChange={(e) => e.target.value && onSendAll(e.target.value as RoleFilter)} className="rounded-md border border-primary/50 bg-card px-3 py-2 text-xs font-bold text-uppercase-wide text-primary disabled:opacity-50">
          <option value="">{sendingAll ? "Enviando…" : "Enviar claves…"}</option>
          <option value="all">A todos ({counts.all})</option>
          <option value="empresa">Sólo empresas ({counts.empresa})</option>
          <option value="sponsor">Sólo soluciones ({counts.sponsor})</option>
        </select>
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
                {f.label} <span className="opacity-70">({counts[f.id]} {counts[f.id] === 1 ? "persona" : "personas"})</span>
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
      {showReminder && <SelectionReminderModal key={id} eventId={id} onClose={() => setShowReminder(false)} />}
      {showAdd && <AddExistingAccountsModal eventId={id} onClose={() => setShowAdd(false)} onDone={load} />}
      {showImport && <ImportUsersModal defaultEventId={id} onClose={() => setShowImport(false)} onDone={load} />}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"><Building2 className="h-4 w-4 text-primary" /><span className="text-2xl font-bold">{accCounts.empresa}</span><span className="text-[11px] font-bold text-uppercase-wide text-muted-foreground">Empresas</span></div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"><Sparkles className="h-4 w-4 text-primary" /><span className="text-2xl font-bold">{accCounts.sponsor}</span><span className="text-[11px] font-bold text-uppercase-wide text-muted-foreground">Soluciones</span></div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"><Users className="h-4 w-4 text-muted-foreground" /><span className="text-2xl font-bold">{accCounts.people}</span><span className="text-[11px] font-bold text-uppercase-wide text-muted-foreground">Personas</span></div>
          <div className="ml-auto inline-flex overflow-hidden rounded-md border border-border">
            <button type="button" onClick={() => setView("grouped")} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-uppercase-wide ${view === "grouped" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}><Layers className="h-3.5 w-3.5" /> Por empresa</button>
            <button type="button" onClick={() => setView("list")} className={`inline-flex items-center gap-1.5 border-l border-border px-3 py-1.5 text-[11px] font-bold text-uppercase-wide ${view === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}><List className="h-3.5 w-3.5" /> Personas</button>
          </div>
        </div>
      )}
      {rows.length > 0 && view === "grouped" && (
        <div className="space-y-2">
          {groups.map((g) => (
            <details key={g.key}
              onDragOver={(e) => { if (dragged) { e.preventDefault(); setDropKey(g.key); } }}
              onDragLeave={() => setDropKey((k) => (k === g.key ? null : k))}
              onDrop={(e) => { e.preventDefault(); onDropPerson(g); }}
              className={`group rounded-xl border bg-card overflow-hidden ${dropKey === g.key ? "border-primary ring-2 ring-primary/40" : "border-border"}`}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/30">
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                {g.role === "sponsor" ? <Sparkles className="h-4 w-4 text-primary" /> : <Building2 className="h-4 w-4 text-primary" />}
                <span className="flex-1 truncate text-sm font-semibold">{g.company}</span>
                {selectionCounts(g.company, [...new Set<string>(g.people.map((r: any) => r.account_id).filter(Boolean))])}
                {g.role === "sponsor" && [...new Set<string>(g.people.map((r: any) => r.account_id).filter(Boolean))].map((accountId) => <FeaturedSolutionStar key={accountId} name={g.company} featured={featuredIds.has(accountId)} busy={featuredBusy} onToggle={() => toggleFeatured(accountId)} />)}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{g.role === "sponsor" ? "Solución" : "Empresa"}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{g.people.length} {g.people.length === 1 ? "persona" : "personas"}</span>
                <button type="button" title="Editar cuenta" disabled={!g.people[0]?.user_id} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditUserId(g.people[0].user_id); }} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-40"><Pencil className="h-4 w-4" /></button>
                <button type="button" title="Quitar del evento (conserva la cuenta y su historial)" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteAccount(g); }} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </summary>
              <ul className="divide-y divide-border border-t border-border bg-muted/10">
                {g.people.map((r: any) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 pl-6">
                    <span draggable title="Arrastra a otra cuenta para moverla" onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragged(r); }} onDragEnd={() => { setDragged(null); setDropKey(null); }} className="cursor-grab p-1 text-muted-foreground hover:text-primary active:cursor-grabbing"><GripVertical className="h-4 w-4" /></span>
                    {r.user_id && r.account_id && <AccountAdminCrown userId={r.user_id} name={r.attendee_name ?? r.attendee_email ?? "Esta persona"} accountName={g.company} isAdmin={r.account_role === "owner"} onChanged={load} />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{r.attendee_name}{r.attendee_role_title ? <span className="text-muted-foreground"> · {r.attendee_role_title}</span> : null}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{r.attendee_email}</div>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{r.status}</span>
                    <div className="whitespace-nowrap">{rowActions(r)}</div>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          {groups.length === 0 && <div className="rounded-xl border border-border bg-card px-4 py-6 text-center text-xs text-muted-foreground">No hay participantes de este tipo en el evento.</div>}
        </div>
      )}
      {rows.length === 0 ? <EmptyState icon={Users} title="Sin participantes" hint="Pulsa «Subir participantes (Excel)» o «Añadir cuentas existentes» para inscribirlos en este evento. Solo quienes estén aquí aparecerán en las selecciones, matches y reuniones del evento." /> : view === "grouped" ? null : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] text-uppercase-wide text-muted-foreground"><tr>
              <th className="px-4 py-3 text-left">Nombre</th><th className="px-4 py-3 text-left">Empresa</th><th className="px-4 py-3 text-left">Selecciones de la cuenta</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Rol</th><th className="px-4 py-3 text-left">Estado</th><th />
            </tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-xs">{r.attendee_name}</td>
                  <td className="px-4 py-3 text-xs">{r.attendee_company}</td>
                  <td className="px-4 py-3">{selectionCounts(r.attendee_company ?? "Cuenta", r.account_id ? [r.account_id] : [])}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.attendee_email}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{roleLabel(r)}</span></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide bg-muted`}>{r.status}</span></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{rowActions(r)}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr className="border-t border-border">
                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-muted-foreground">
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
