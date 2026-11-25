import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Mic } from "lucide-react";
import talksData from "@/data/talks-conectamos27h.json";

type Person = { name: string; empresa: string };
type Talk = { id: string; date: string; start: string; end: string; people: Person[] };

const dayName = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

export function TalksPanel({ eventId }: { eventId: string | null }) {
  const [view, setView] = useState<string>("all");
  const [q, setQ] = useState("");
  const talks: Talk[] = talksData.eventId === eventId ? (talksData.talks as Talk[]) : [];

  const byPerson = useMemo(() => {
    const m = new Map<string, { name: string; empresa: string; talks: string[] }>();
    talks.forEach((t) => t.people.forEach((p) => {
      const k = `${p.name}|${p.empresa}`;
      if (!m.has(k)) m.set(k, { ...p, talks: [] });
      m.get(k)!.talks.push(t.id);
    }));
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [talks]);

  const match = (p: Person) => !q || `${p.name} ${p.empresa}`.toLowerCase().includes(q.toLowerCase());

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byPerson.map((p) => ({ Persona: p.name, Empresa: p.empresa, Talks: p.talks.join(", ") }))), "Por persona");
    talks.forEach((t) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(t.people.map((p) => ({ Persona: p.name, Empresa: p.empresa, Día: t.date, Horario: `${t.start}–${t.end}` }))), t.id));
    XLSX.writeFile(wb, `talks-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (!talks.length) return <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Este evento no tiene personas asignadas a Talks.</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {talks.map((t) => (
          <button key={t.id} onClick={() => setView(view === t.id ? "all" : t.id)} className={`rounded-xl border p-3 text-left transition ${view === t.id ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/50"}`}>
            <div className="flex items-center gap-2 text-sm font-bold"><Mic className="h-4 w-4" />{t.id}</div>
            <div className="text-xs text-muted-foreground capitalize">{dayName(t.date)} · {t.start}–{t.end}</div>
            <div className="mt-1 text-xs font-bold">{t.people.length} personas</div>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <select value={view} onChange={(e) => setView(e.target.value)} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs">
          <option value="all">Por persona (todas)</option>
          {talks.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona o empresa" className="rounded-md border border-border bg-input px-3 py-1.5 text-xs min-w-[220px]" />
        <button onClick={exportExcel} className="ml-auto inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-bold text-uppercase-wide hover:bg-muted"><FileSpreadsheet className="h-4 w-4" /> Exportar Excel</button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] text-uppercase-wide text-muted-foreground"><tr>
            <th className="px-4 py-3 text-left">Persona</th><th className="px-4 py-3 text-left">Empresa</th><th className="px-4 py-3 text-left">{view === "all" ? "Talks" : "Horario"}</th>
          </tr></thead>
          <tbody>
            {view === "all"
              ? byPerson.filter(match).map((p) => (
                <tr key={p.name + p.empresa} className="border-t border-border"><td className="px-4 py-2 text-xs font-medium">{p.name}</td><td className="px-4 py-2 text-xs">{p.empresa}</td><td className="px-4 py-2 text-xs">{p.talks.join(", ")}</td></tr>))
              : (() => { const t = talks.find((x) => x.id === view)!; return t.people.filter(match).map((p) => (
                <tr key={p.name + p.empresa} className="border-t border-border"><td className="px-4 py-2 text-xs font-medium">{p.name}</td><td className="px-4 py-2 text-xs">{p.empresa}</td><td className="px-4 py-2 text-xs capitalize">{dayName(t.date)} · {t.start}–{t.end}</td></tr>)); })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
