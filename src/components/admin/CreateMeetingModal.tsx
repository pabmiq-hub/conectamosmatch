import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createMeeting, listAllParticipants } from "@/lib/admin-meetings.functions";

type Responsable = { full_name: string; role?: string | null; email?: string | null };
type Party = { user_id: string; name: string; responsables: Responsable[] };

export function CreateMeetingModal({ eventId, onClose, onCreated }: { eventId: string | null; onClose: () => void; onCreated: () => void }) {
  const list = useServerFn(listAllParticipants);
  const create = useServerFn(createMeeting);
  const [parts, setParts] = useState<{ empresas: Party[]; sponsors: Party[] } | null>(null);
  const [empresa, setEmpresa] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [empResp, setEmpResp] = useState("");
  const [spResp, setSpResp] = useState("");
  const [time, setTime] = useState("");
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { list().then(setParts as any).catch(() => setParts({ empresas: [], sponsors: [] })); }, []);

  const empRespList = useMemo(() => parts?.empresas.find((e) => e.user_id === empresa)?.responsables ?? [], [parts, empresa]);
  const spRespList = useMemo(() => parts?.sponsors.find((s) => s.user_id === sponsor)?.responsables ?? [], [parts, sponsor]);

  useEffect(() => { setEmpResp(""); }, [empresa]);
  useEffect(() => { setSpResp(""); }, [sponsor]);

  async function submit() {
    if (!empresa || !sponsor) return toast.error("Elige empresa y solución");
    setBusy(true);
    try {
      const ep = empRespList[Number(empResp)];
      const sp = spRespList[Number(spResp)];
      await create({ data: {
        event_id: eventId,
        empresa_user_id: empresa,
        sponsor_user_id: sponsor,
        scheduled_time: time ? new Date(time).toISOString() : null,
        room: room || null,
        empresa_responsable: ep ? { full_name: ep.full_name, role: ep.role ?? "", email: ep.email ?? "" } : null,
        sponsor_responsable: sp ? { full_name: sp.full_name, role: sp.role ?? "", email: sp.email ?? "" } : null,
      }});
      toast.success("Reunión creada");
      onCreated();
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-uppercase-wide">Crear reunión 1to1</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">Puedes asignar una reunión entre cualquier empresa y solución, aunque no exista match entre ambos.</p>

        <div className="space-y-4">
          <Field label="Empresa *">
            <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
              <option value="">— Selecciona empresa —</option>
              {parts?.empresas.map((e) => <option key={e.user_id} value={e.user_id}>{e.name}</option>)}
            </select>
          </Field>
          {empresa && (
            <Field label="Responsable empresa (opcional)">
              <select value={empResp} onChange={(e) => setEmpResp(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" disabled={empRespList.length === 0}>
                <option value="">{empRespList.length === 0 ? "— Sin responsables —" : "— Sin asignar —"}</option>
                {empRespList.map((r, i) => <option key={i} value={String(i)}>{r.full_name}{r.role ? ` · ${r.role}` : ""}</option>)}
              </select>
            </Field>
          )}
          <Field label="Solución *">
            <select value={sponsor} onChange={(e) => setSponsor(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
              <option value="">— Selecciona solución —</option>
              {parts?.sponsors.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
            </select>
          </Field>
          {sponsor && (
            <Field label="Responsable solución (opcional)">
              <select value={spResp} onChange={(e) => setSpResp(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" disabled={spRespList.length === 0}>
                <option value="">{spRespList.length === 0 ? "— Sin responsables —" : "— Sin asignar —"}</option>
                {spRespList.map((r, i) => <option key={i} value={String(i)}>{r.full_name}{r.role ? ` · ${r.role}` : ""}</option>)}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hora (opcional)">
              <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
            </Field>
            <Field label="Mesa (opcional)">
              <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Mesa 1" className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
            </Field>
          </div>
        </div>

        <div className="flex gap-2 pt-5">
          <button onClick={onClose} className="flex-1 rounded-md border border-border py-2.5 text-sm font-bold text-uppercase-wide">Cancelar</button>
          <button onClick={submit} disabled={busy} className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
            {busy ? "Creando…" : "Crear reunión"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-uppercase-wide text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
