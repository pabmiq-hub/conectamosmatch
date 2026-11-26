import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Mic, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listEventTalks, removeTalkPerson } from "@/lib/admin-talks.functions";
import type { TalkPerson } from "@/lib/talk-attendance";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const dayName = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

export function TalksPanel({ eventId }: { eventId: string | null }) {
  const [view, setView] = useState("all");
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<{ person: TalkPerson; talkId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useServerFn(listEventTalks);
  const remove = useServerFn(removeTalkPerson);
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin-talks", eventId],
    queryFn: () => eventId ? list({ data: { event_id: eventId } }) : Promise.resolve({ talks: [] }),
    enabled: !!eventId,
  });
  const talks = data?.talks ?? [];
  const byPerson = useMemo(() => {
    const m = new Map<string, TalkPerson & { talks: string[] }>();
    talks.forEach((t) => t.people.forEach((p) => {
      const k = JSON.stringify([p.name, p.empresa]);
      const entry = m.get(k) ?? { ...p, talks: [] };
      entry.talks.push(t.id);
      m.set(k, entry);
    }));
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [talks]);
  const match = (p: TalkPerson) => !q || `${p.name} ${p.empresa}`.toLowerCase().includes(q.toLowerCase());
  const selected = talks.find((t) => t.id === view);
  const rows = view === "all" ? byPerson : (selected?.people ?? []).map((p) => ({ ...p, talks: [view] }));

  async function confirmRemoval() {
    if (!pending || !eventId) return;
    setBusy(true);
    try {
      await remove({ data: { event_id: eventId, talk_id: pending.talkId, person_name: pending.person.name, company_name: pending.person.empresa } });
      await queryClient.invalidateQueries({ queryKey: ["admin-talks", eventId] });
      setPending(null);
      toast.success("Persona retirada del Talk");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se ha podido quitar a la persona"); }
    finally { setBusy(false); }
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byPerson.map((p) => ({ Persona: p.name, Empresa: p.empresa, Talks: p.talks.join(", ") }))), "Por persona");
    talks.forEach((t) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(t.people.map((p) => ({ Persona: p.name, Empresa: p.empresa, Día: t.date, Horario: `${t.start}–${t.end}` }))), t.id));
    XLSX.writeFile(wb, `talks-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (!eventId) return <p className="p-6 text-center text-sm text-muted-foreground">Selecciona un evento.</p>;
  if (isPending) return <p className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando Talks…</p>;
  if (isError) return <div className="p-6 text-center"><p className="text-sm text-destructive">No se han podido cargar los Talks.</p><Button variant="outline" className="mt-3" onClick={() => void refetch()}>Reintentar</Button></div>;
  if (!talks.length) return <p className="p-6 text-center text-sm text-muted-foreground">Este evento no tiene personas asignadas a Talks.</p>;

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {talks.map((t) => <Button key={t.id} variant="outline" onClick={() => setView(view === t.id ? "all" : t.id)} className={`h-auto flex-col items-start whitespace-normal p-3 text-left ${view === t.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
        <span className="flex items-center gap-2 text-sm font-bold"><Mic className="h-4 w-4" />{t.id}</span>
        <span className="text-xs text-muted-foreground capitalize">{dayName(t.date)} · {t.start}–{t.end}</span>
        <span className="mt-1 text-xs font-bold">{t.people.length} personas</span>
      </Button>)}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <select aria-label="Vista de Talks" value={view} onChange={(e) => setView(e.target.value)} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs">
        <option value="all">Por persona (todas)</option>
        {talks.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
      </select>
      <input aria-label="Buscar persona o empresa" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona o empresa" className="min-w-0 rounded-md border border-border bg-input px-3 py-1.5 text-xs" />
      <Button variant="outline" size="sm" onClick={exportExcel} className="sm:ml-auto"><FileSpreadsheet className="h-4 w-4" />Exportar Excel</Button>
    </div>
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[10px] text-uppercase-wide text-muted-foreground"><tr>
          <th className="px-4 py-3 text-left">Persona</th><th className="px-4 py-3 text-left">Empresa</th><th className="px-4 py-3 text-left">{view === "all" ? "Talks" : "Horario"}</th><th className="px-4 py-3 text-right">Quitar de Talk</th>
        </tr></thead>
        <tbody>{rows.filter(match).map((p) => <tr key={JSON.stringify([p.name, p.empresa])} className="border-t border-border">
          <td className="px-4 py-2 text-xs font-medium">{p.name}</td><td className="px-4 py-2 text-xs">{p.empresa}</td>
          <td className="px-4 py-2 text-xs capitalize">{view === "all" ? p.talks.join(", ") : selected ? `${dayName(selected.date)} · ${selected.start}–${selected.end}` : ""}</td>
          <td className="px-4 py-2"><div className="flex flex-wrap justify-end gap-1">{p.talks.map((id) => <Button key={id} variant="ghost" size={view === "all" ? "sm" : "icon"} title={`Quitar a ${p.name} de ${id}`} aria-label={`Quitar a ${p.name} de ${id}`} disabled={busy} onClick={() => setPending({ person: p, talkId: id })} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" />{view === "all" && id}</Button>)}</div></td>
        </tr>)}
        {rows.filter(match).length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">No hay personas en esta lista.</td></tr>}
        </tbody>
      </table>
    </div>
    <Dialog open={!!pending} onOpenChange={(open) => { if (!open && !busy) setPending(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Quitar persona del Talk</DialogTitle><DialogDescription>
        ¿Quitar a {pending?.person.name} ({pending?.person.empresa}) de {pending?.talkId}? Su horario quedará libre de este Talk. Sus otras asignaciones y reuniones no cambiarán.
      </DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setPending(null)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={() => void confirmRemoval()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{busy ? "Quitando…" : "Quitar del Talk"}</Button></DialogFooter></DialogContent>
    </Dialog>
  </div>;
}
