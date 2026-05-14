import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Users, ArrowLeft, Check, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listRegistrations, toggleCheckIn, deleteRegistration } from "@/lib/admin-registrations.functions";

export const Route = createFileRoute("/_authenticated/admin/eventos/$id/registros")({
  component: AdminRegistros,
});

function AdminRegistros() {
  const { id } = Route.useParams();
  const list = useServerFn(listRegistrations);
  const toggle = useServerFn(toggleCheckIn);
  const del = useServerFn(deleteRegistration);
  const [rows, setRows] = useState<any[]>([]);

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
      <Link to="/admin/eventos" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Volver a eventos</Link>
      <PageHeader title="Inscritos" subtitle={`Total: ${rows.length} · Check-in: ${rows.filter((r) => r.checked_in_at).length}`} right={
        <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide"><Download className="h-3 w-3" /> Exportar CSV</button>
      } />
      {rows.length === 0 ? <EmptyState icon={Users} title="Sin inscritos" /> : (
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
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide ${r.checked_in_at ? "bg-success/15 text-success" : "bg-muted"}`}>{r.checked_in_at ? "✓ Check-in" : r.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={async () => {
                      try { await toggle({ data: { id: r.id, checkedIn: !r.checked_in_at } }); load(); }
                      catch (e: any) { toast.error(e?.message ?? "Error"); }
                    }} className="p-1.5 text-muted-foreground hover:text-success" title="Check-in"><Check className="h-4 w-4" /></button>
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
