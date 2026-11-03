import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { FileUp, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { retoDb } from "@/lib/reto";
import { adminAddParticipants, adminRemoveParticipants, matchEmails, parseEmailList } from "@/lib/reto-admin";

type Part = { user_id: string; display_name: string; company_name: string | null; participant_type: string; cargo: string | null };
type Candidate = { id: string; full_name: string | null; email: string | null; role: string; is_active: boolean | null; company: string | null };

const btn = "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-accent disabled:opacity-50";

export function RetoParticipantsAdmin({ eventId, locked, onChanged }: { eventId: string; locked: boolean; onChanged: () => void }) {
  const [parts, setParts] = useState<Part[]>([]);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importInfo, setImportInfo] = useState<{ found: string[]; missing: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [{ data: ps }, { data: profs }, { data: emps }, { data: sps }] = await Promise.all([
      retoDb.from("reto_participants").select("user_id, display_name, company_name, participant_type, cargo").eq("event_id", eventId).order("display_name"),
      retoDb.from("profiles").select("id, full_name, email, role, is_active, account_id").in("role", ["empresa", "sponsor"]),
      retoDb.from("empresa_profiles").select("id, user_id, company_name"),
      retoDb.from("sponsor_profiles").select("id, user_id, company_name"),
    ]);
    setParts(ps ?? []);
    const companyOf = (p: any) => {
      const list = p.role === "sponsor" ? sps : emps;
      return (list ?? []).find((c: any) => c.id === p.account_id || c.user_id === p.id)?.company_name ?? null;
    };
    setCands((profs ?? []).map((p: any) => ({ ...p, company: companyOf(p) })));
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const inReto = useMemo(() => new Set(parts.map((p) => p.user_id)), [parts]);
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return parts.filter((p) => !t || `${p.display_name} ${p.company_name ?? ""} ${p.cargo ?? ""}`.toLowerCase().includes(t));
  }, [parts, q]);

  const add = async (ids: string[]) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      const n = await adminAddParticipants(eventId, ids);
      toast.success(`${n} participante${n === 1 ? "" : "s"} añadido${n === 1 ? "" : "s"} o actualizado${n === 1 ? "" : "s"}`);
      setAdding(false); setImportInfo(null);
      await load(); onChanged();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const remove = async (p: Part) => {
    if (!confirm(`¿Dar de baja a ${p.display_name}? Dejará de contar en el ranking y el colectivo. Si vuelve a darse de alta, recupera sus conexiones.`)) return;
    setBusy(true);
    try {
      await adminRemoveParticipants(eventId, [p.user_id]);
      toast.success("Baja registrada");
      await load(); onChanged();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const onFile = async (f: File) => {
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
      const emails = parseEmailList(rows);
      if (!emails.length) { toast.error("No he encontrado emails en el archivo"); return; }
      setImportInfo(matchEmails(emails, cands));
    } catch {
      toast.error("No se pudo leer el archivo");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-uppercase-wide">
          <Users className="h-4 w-4 text-primary" /> Participantes ({parts.length})
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <button className={btn} disabled={busy || locked} onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" /> Importar listado</button>
          <button className={btn} disabled={busy || locked} onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" /> Añadir</button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        El listado usa los usuarios que ya existen en la plataforma. Para personas nuevas, créalas antes en Usuarios → Importar y después súbelas aquí con un Excel que tenga una columna «Email».
        {locked && " El Reto está cerrado: reábrelo para cambiar participantes."}
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar participante…"
          className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm" />
      </div>

      <ul className="max-h-[420px] overflow-y-auto divide-y divide-border rounded-lg border border-border">
        {visible.map((p) => (
          <li key={p.user_id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{p.display_name}</div>
              <div className="truncate text-xs text-muted-foreground">{[p.cargo, p.company_name].filter(Boolean).join(" · ") || "Sin empresa"}</div>
            </div>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{p.participant_type === "sponsor" ? "Sponsor" : "DRH"}</span>
            <button className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              disabled={busy || locked} onClick={() => remove(p)} aria-label={`Dar de baja a ${p.display_name}`}>
              <UserMinus className="h-4 w-4" />
            </button>
          </li>
        ))}
        {!visible.length && <li className="px-3 py-6 text-center text-xs text-muted-foreground">Sin participantes</li>}
      </ul>

      <AddDialog open={adding} onOpenChange={setAdding} cands={cands} inReto={inReto} busy={busy} onAdd={add} />

      <Dialog open={!!importInfo} onOpenChange={(o) => !o && setImportInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar listado</DialogTitle>
            <DialogDescription>
              {importInfo?.found.length ?? 0} personas encontradas en la plataforma
              {importInfo && importInfo.found.filter((id) => inReto.has(id)).length > 0 &&
                ` (${importInfo.found.filter((id) => inReto.has(id)).length} ya estaban; se actualizan sus datos)`}.
            </DialogDescription>
          </DialogHeader>
          {!!importInfo?.missing.length && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
              <div className="font-bold">{importInfo.missing.length} emails sin usuario (créalos primero en Usuarios → Importar):</div>
              <div className="mt-1 max-h-32 overflow-y-auto text-muted-foreground">{importInfo.missing.join(", ")}</div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className={btn} onClick={() => setImportInfo(null)}>Cancelar</button>
            <button disabled={busy || !importInfo?.found.length} onClick={() => importInfo && add(importInfo.found)}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-uppercase-wide text-primary-foreground disabled:opacity-50">
              Añadir {importInfo?.found.length ?? 0}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AddDialog({ open, onOpenChange, cands, inReto, busy, onAdd }: {
  open: boolean; onOpenChange: (o: boolean) => void; cands: Candidate[]; inReto: Set<string>; busy: boolean; onAdd: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"todos" | "empresa" | "sponsor">("todos");
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => { if (!open) { setSel(new Set()); setQ(""); } }, [open]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return cands
      .filter((c) => !inReto.has(c.id) && c.is_active !== false && (type === "todos" || c.role === type))
      .filter((c) => !t || `${c.full_name ?? ""} ${c.email ?? ""} ${c.company ?? ""}`.toLowerCase().includes(t))
      .sort((a, b) => (a.company ?? "").localeCompare(b.company ?? "", "es") || (a.full_name ?? "").localeCompare(b.full_name ?? "", "es"));
  }, [cands, inReto, q, type]);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = list.length > 0 && list.every((c) => sel.has(c.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Añadir participantes</DialogTitle>
          <DialogDescription>Usuarios activos de empresa (DRH) y solución (sponsor) que aún no juegan.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, email o empresa…"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="rounded-lg border border-border bg-background px-2 text-sm">
            <option value="todos">Todos</option><option value="empresa">Empresas</option><option value="sponsor">Soluciones</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(list.map((c) => c.id)))} />
          Seleccionar los {list.length} visibles
        </label>
        <ul className="max-h-80 overflow-y-auto divide-y divide-border rounded-lg border border-border">
          {list.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-accent">
                <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{c.full_name || c.email}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.company ?? "Sin empresa"} · {c.role === "sponsor" ? "Solución" : "Empresa"}</div>
                </div>
              </label>
            </li>
          ))}
          {!list.length && <li className="px-3 py-6 text-center text-xs text-muted-foreground">No quedan usuarios por añadir</li>}
        </ul>
        <div className="flex justify-end">
          <button disabled={busy || !sel.size} onClick={() => onAdd([...sel])}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-uppercase-wide text-primary-foreground disabled:opacity-50">
            Añadir {sel.size}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
