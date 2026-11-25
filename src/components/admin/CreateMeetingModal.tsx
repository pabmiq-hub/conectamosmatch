import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createMeeting, listAllParticipants, getMeetingSlotAvailability, getEventSlotOccupancy } from "@/lib/admin-meetings.functions";

type Responsable = { profile_id: string; full_name: string; role?: string | null; email?: string | null };
type Party = { account_id: string; user_id: string | null; name: string; responsables: Responsable[] };

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
  const avail = useServerFn(getMeetingSlotAvailability);
  const [slots, setSlots] = useState<{ iso: string; free: boolean; reasons: string[]; suggested_room: string | null }[] | null>(null);
  const [slotIso, setSlotIso] = useState("");
  const occFn = useServerFn(getEventSlotOccupancy);
  const [occ, setOcc] = useState<{ iso: string; empresas: string[]; sponsors: string[] }[]>([]);
  const [preSlot, setPreSlot] = useState("");
  useEffect(() => { if (eventId) occFn({ data: { event_id: eventId } }).then((r: any) => setOcc(r.slots)).catch(() => setOcc([])); }, [eventId]);
  const preOcc = occ.find((o) => o.iso === preSlot);
  const oneSide = (empresa ? 1 : 0) + (sponsor ? 1 : 0) === 1;

  useEffect(() => { list({ data: { event_id: eventId } }).then(setParts as any).catch(() => setParts({ empresas: [], sponsors: [] })); }, [eventId]);

  const empParty = useMemo(() => parts?.empresas.find((e) => e.account_id === empresa), [parts, empresa]);
  const spParty = useMemo(() => parts?.sponsors.find((s) => s.account_id === sponsor), [parts, sponsor]);
  const empRespList = empParty?.responsables ?? [];
  const spRespList = spParty?.responsables ?? [];

  useEffect(() => { setEmpResp(""); }, [empresa]);
  useEffect(() => { setSpResp(""); }, [sponsor]);
  useEffect(() => {
    setSlots(null); setSlotIso("");
    if (!eventId || !empresa || !sponsor) return;
    avail({ data: { event_id: eventId, empresa_account_id: empresa, sponsor_account_id: sponsor, empresa_user_id: empResp || null } })
      .then((r: any) => { setSlots(r.slots); const m = r.slots.find((x: any) => x.iso === preSlot && x.free); if (m) { setSlotIso(m.iso); if (m.suggested_room) setRoom(m.suggested_room); } }).catch(() => setSlots([]));
  }, [eventId, empresa, sponsor, empResp]);
  const fmt = (iso: string) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  async function submit() {
    if (!empresa || !sponsor) return toast.error("Elige empresa y solución");
    const ep = empRespList.find((r) => r.profile_id === empResp);
    const sp = spRespList.find((r) => r.profile_id === spResp);
    const empresaUserId = ep?.profile_id ?? empParty?.user_id;
    const sponsorUserId = sp?.profile_id ?? spParty?.user_id;
    if (!empresaUserId || !sponsorUserId) return toast.error("La cuenta necesita un responsable activo para crear una reunión");
    setBusy(true);
    try {
      await create({ data: {
        event_id: eventId,
        // If a responsable is chosen, the meeting belongs to that profile so it shows in their agenda
        empresa_user_id: empresaUserId,
        sponsor_user_id: sponsorUserId,
        scheduled_time: slotIso || (time ? new Date(time).toISOString() : null),
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
          {occ.length > 0 && (
            <Field label="Empezar por slot (opcional)">
              <select value={preSlot} onChange={(e) => setPreSlot(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
                <option value="">— Cualquier slot —</option>
                {occ.map((o, i) => {
                  const busy = (empresa && o.empresas.includes(empresa)) || (sponsor && o.sponsors.includes(sponsor));
                  return <option key={o.iso} value={o.iso} disabled={!!busy}>Slot {i + 1} · {fmt(o.iso)}{busy ? " · Ocupado" : ""}</option>;
                })}
              </select>
              {preSlot && oneSide && <p className="mt-1 text-[11px] text-muted-foreground">En la otra lista solo podrás elegir cuentas libres en ese slot.</p>}
            </Field>
          )}
          <Field label="Empresa *">
            <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
              <option value="">— Selecciona empresa —</option>
              {parts?.empresas.map((e) => <option key={e.account_id} value={e.account_id} disabled={!e.user_id || !!preOcc?.empresas.includes(e.account_id)}>{e.name}{!e.user_id ? " · Sin responsable activo" : preOcc?.empresas.includes(e.account_id) ? " · Ocupada en ese slot" : ""}</option>)}
            </select>
          </Field>
          {empresa && (
            <Field label="Responsable empresa (opcional)">
              <select value={empResp} onChange={(e) => setEmpResp(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
                <option value="">{empRespList.length === 0 ? "— Sin equipo registrado —" : "— Sin asignar —"}</option>
                {empRespList.map((r) => <option key={r.profile_id} value={r.profile_id}>{r.full_name}{r.role ? ` · ${r.role}` : ""}</option>)}
              </select>
            </Field>
          )}
          <Field label="Solución *">
            <select value={sponsor} onChange={(e) => setSponsor(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
              <option value="">— Selecciona solución —</option>
              {parts?.sponsors.map((s) => <option key={s.account_id} value={s.account_id} disabled={!s.user_id || !!preOcc?.sponsors.includes(s.account_id)}>{s.name}{!s.user_id ? " · Sin responsable activo" : preOcc?.sponsors.includes(s.account_id) ? " · Ocupada en ese slot" : ""}</option>)}
            </select>
          </Field>
          {sponsor && (
            <Field label="Responsable solución (opcional)">
              <select value={spResp} onChange={(e) => setSpResp(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
                <option value="">{spRespList.length === 0 ? "— Sin equipo registrado —" : "— Sin asignar —"}</option>
                {spRespList.map((r) => <option key={r.profile_id} value={r.profile_id}>{r.full_name}{r.role ? ` · ${r.role}` : ""}</option>)}
              </select>
            </Field>
          )}
          {slots && slots.length > 0 && (
            <Field label="Slot disponible">
              <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
                {slots.map((sl, i) => (
                  <button key={sl.iso} type="button" disabled={!sl.free}
                    onClick={() => { setSlotIso(sl.iso); setTime(""); if (sl.suggested_room) setRoom(sl.suggested_room); }}
                    title={sl.reasons.join(" · ")}
                    className={`rounded-md border px-2 py-1.5 text-left text-xs ${slotIso === sl.iso ? "border-primary bg-primary/15" : sl.free ? "border-border hover:border-primary" : "border-destructive/40 bg-destructive/10 opacity-60 cursor-not-allowed"}`}>
                    <div className="font-bold">Slot {i + 1} · {fmt(sl.iso)}</div>
                    <div className={sl.free ? "text-muted-foreground" : "text-destructive"}>{sl.free ? `Libre${sl.suggested_room ? ` · ${sl.suggested_room}` : ""}` : sl.reasons.join(" · ")}</div>
                  </button>
                ))}
              </div>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={slots && slots.length ? "u otra hora (opcional)" : "Hora (opcional)"}>
              <input type="datetime-local" value={time} onChange={(e) => { setTime(e.target.value); setSlotIso(""); }} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
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
