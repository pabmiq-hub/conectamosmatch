import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createMeeting, listAllParticipants, getMeetingSlotAvailability, getEventSlotOccupancy } from "@/lib/admin-meetings.functions";
import { resolveMeetingFormTime } from "@/lib/meeting-form-time";

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
  type TalkConflict = { person: string; talk: string; start: string; end: string };
  const [slots, setSlots] = useState<{ iso: string; free: boolean; reasons: string[]; talk_conflicts: TalkConflict[]; suggested_room: string | null }[] | null>(null);
  const [mode, setMode] = useState<"empresa" | "sponsor">("empresa");
  const [slotIso, setSlotIso] = useState("");
  const occFn = useServerFn(getEventSlotOccupancy);
  const [occ, setOcc] = useState<{ iso: string; empresas: string[]; sponsors: string[] }[]>([]);
  const preSlot = slotIso;
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
    let cancelled = false;
    setSlots(null);
    if (!eventId || (!empresa && !sponsor)) return;
    avail({ data: { event_id: eventId, empresa_account_id: empresa || null, sponsor_account_id: sponsor || null, empresa_user_id: empresa ? (empResp || empParty?.user_id || null) : null, sponsor_user_id: sponsor ? (spResp || spParty?.user_id || null) : null } })
      .then((r: any) => { if (!cancelled) setSlots(r.slots); }).catch(() => { if (!cancelled) setSlots([]); });
    return () => { cancelled = true; };
  }, [eventId, empresa, sponsor, empResp, spResp, empParty?.user_id, spParty?.user_id]);
  const fmt = (iso: string) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  const chosen = slots?.find((x) => x.iso === slotIso);
  useEffect(() => { if (chosen?.free && chosen.suggested_room) setRoom(chosen.suggested_room); }, [chosen]);
  const rescue = empresa && sponsor ? chosen?.talk_conflicts ?? [] : [];
  async function submit() {
    if (!empresa || !sponsor) return toast.error("Elige empresa y solución");
    const ep = empRespList.find((r) => r.profile_id === empResp);
    const sp = spRespList.find((r) => r.profile_id === spResp);
    const empresaUserId = ep?.profile_id ?? empParty?.user_id;
    const sponsorUserId = sp?.profile_id ?? spParty?.user_id;
    if (!empresaUserId || !sponsorUserId) return toast.error("La cuenta necesita un responsable activo para crear una reunión");
    setBusy(true);
    try {
      const scheduledTime = resolveMeetingFormTime(slotIso, time, slots);
      await create({ data: {
        event_id: eventId,
        // If a responsable is chosen, the meeting belongs to that profile so it shows in their agenda
        empresa_user_id: empresaUserId,
        sponsor_user_id: sponsorUserId,
        scheduled_time: scheduledTime,
        room: room || null,
        empresa_responsable: ep ? { full_name: ep.full_name, role: ep.role ?? "", email: ep.email ?? "" } : null,
        sponsor_responsable: sp ? { full_name: sp.full_name, role: sp.role ?? "", email: sp.email ?? "" } : null,
        rescue_from_talks: rescue.length > 0,
      }});
      toast.success(rescue.length ? `Reunión creada · ${rescue.map((r) => r.person).join(", ")} sale de ${rescue.map((r) => r.talk).join(", ")}` : "Reunión creada");
      onCreated();
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setBusy(false); }
  }

  const empBlock = (<>
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
  </>);
  const spBlock = (<>
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
  </>);
  const pickSlot = (iso: string, room: string | null) => { setSlotIso(iso); setTime(""); if (room) setRoom(room); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-uppercase-wide">Crear reunión 1to1</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">Puedes asignar una reunión entre cualquier empresa y solución, aunque no exista match entre ambos.</p>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-md border border-border p-1">
          {(["empresa", "sponsor"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`rounded px-3 py-1.5 text-xs font-bold text-uppercase-wide ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {m === "empresa" ? "Empezar por empresa" : "Empezar por solución"}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          {occ.length > 0 && (
            <Field label="Empezar por slot (opcional)">
              <select value={preSlot} onChange={(e) => pickSlot(e.target.value, null)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
                <option value="">— Cualquier slot —</option>
                {occ.map((o, i) => {
                  const busy = (empresa && o.empresas.includes(empresa)) || (sponsor && o.sponsors.includes(sponsor));
                  return <option key={o.iso} value={o.iso} disabled={!!busy}>Slot {i + 1} · {fmt(o.iso)}{busy ? " · Ocupado" : ""}</option>;
                })}
              </select>
              {preSlot && oneSide && <p className="mt-1 text-[11px] text-muted-foreground">En la otra lista solo podrás elegir cuentas libres en ese slot.</p>}
            </Field>
          )}
          {mode === "empresa" ? <>{empBlock}{spBlock}</> : <>{spBlock}{empBlock}</>}
          {slots && slots.length > 0 && (
            <Field label="Slot disponible">
              <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
                {slots.map((sl, i) => (
                  <button key={sl.iso} type="button" disabled={!sl.free}
                    onClick={() => pickSlot(sl.iso, sl.suggested_room)}
                    title={[...sl.reasons, ...sl.talk_conflicts.map((t) => `${t.person} en ${t.talk}`)].join(" · ")}
                    className={`rounded-md border px-2 py-1.5 text-left text-xs ${slotIso === sl.iso ? "border-primary bg-primary/15" : !sl.free ? "border-destructive/40 bg-destructive/10 opacity-60 cursor-not-allowed" : sl.talk_conflicts.length ? "border-accent bg-accent/15 hover:border-primary" : "border-border hover:border-primary"}`}>
                    <div className="font-bold">Slot {i + 1} · {fmt(sl.iso)}</div>
                    <div className={!sl.free ? "text-destructive" : "text-muted-foreground"}>{!sl.free ? sl.reasons.join(" · ") : sl.talk_conflicts.length ? `⚠ En ${sl.talk_conflicts.map((t) => t.talk).join(", ")} · Rescatable` : `Libre${sl.suggested_room ? ` · ${sl.suggested_room}` : ""}`}</div>
                  </button>
                ))}
              </div>
            </Field>
          )}
          {slots && !(empresa && sponsor) && <p className="text-[11px] text-muted-foreground">Elige un slot y después la {empresa ? "solución" : "empresa"}: solo podrás elegir cuentas libres en ese slot.</p>}
          {rescue.length > 0 && (
            <div className="rounded-md border border-accent bg-accent/15 p-3 text-xs">
              {rescue.map((r) => <p key={r.person + r.talk}><b>{r.person}</b> está en <b>{r.talk}</b> ({r.start}–{r.end}). Al crear la reunión saldrá de la Talk y quedará en esta reunión 1to1.</p>)}
            </div>
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
          <button onClick={submit} disabled={busy || (!!slotIso && !chosen?.free)} className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
            {busy ? "Creando…" : rescue.length ? "Rescatar y crear reunión" : "Crear reunión"}
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
