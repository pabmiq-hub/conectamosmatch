import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createMeeting, listAllParticipants } from "@/lib/admin-meetings.functions";

export function CreateMeetingModal({ eventId, onClose, onCreated }: { eventId: string | null; onClose: () => void; onCreated: () => void }) {
  const list = useServerFn(listAllParticipants);
  const create = useServerFn(createMeeting);
  const [parts, setParts] = useState<{ empresas: { user_id: string; name: string }[]; sponsors: { user_id: string; name: string }[] } | null>(null);
  const [empresa, setEmpresa] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [time, setTime] = useState("");
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { list().then(setParts).catch(() => setParts({ empresas: [], sponsors: [] })); }, []);

  async function submit() {
    if (!empresa || !sponsor) return toast.error("Elige empresa y sponsor");
    setBusy(true);
    try {
      await create({ data: {
        event_id: eventId,
        empresa_user_id: empresa,
        sponsor_user_id: sponsor,
        scheduled_time: time ? new Date(time).toISOString() : null,
        room: room || null,
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
        <p className="text-[11px] text-muted-foreground mb-4">Puedes asignar una reunión entre cualquier empresa y sponsor, aunque no exista match entre ambos.</p>

        <div className="space-y-4">
          <Field label="Empresa *">
            <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
              <option value="">— Selecciona empresa —</option>
              {parts?.empresas.map((e) => <option key={e.user_id} value={e.user_id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label="Sponsor *">
            <select value={sponsor} onChange={(e) => setSponsor(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
              <option value="">— Selecciona sponsor —</option>
              {parts?.sponsors.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hora (opcional)">
              <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
            </Field>
            <Field label="Sala (opcional)">
              <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Sala A" className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
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
