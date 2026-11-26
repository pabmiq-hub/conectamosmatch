import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createMeeting, listAllParticipants, getMeetingSlotAvailability, getEventSlotOccupancy } from "@/lib/admin-meetings.functions";
import { resolveMeetingFormTime } from "@/lib/meeting-form-time";
import { accountHasFreeResponsible, type MeetingSide } from "@/lib/meeting-availability";

type Responsable = { profile_id: string; full_name: string; role?: string | null; email?: string | null };
type Party = { account_id: string; user_id: string | null; name: string; responsables: Responsable[] };
type TalkConflict = { person: string; talk: string; start: string; end: string };
type SlotAvailability = {
  iso: string;
  free: boolean;
  reasons: string[];
  talk_conflicts: TalkConflict[];
  suggested_room: string | null;
  available_empresa_users: string[];
  available_sponsor_users: string[];
};
type ResponsibleOccupancy = { user_id: string; room: string | null };
type EventOccupancy = {
  iso: string;
  empresas: string[];
  sponsors: string[];
  empresa_users: string[];
  sponsor_users: string[];
  empresa_responsables: ResponsibleOccupancy[];
  sponsor_responsables: ResponsibleOccupancy[];
};

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
  const [slots, setSlots] = useState<SlotAvailability[] | null>(null);
  const [mode, setMode] = useState<"empresa" | "sponsor">("empresa");
  const [slotIso, setSlotIso] = useState("");
  const occFn = useServerFn(getEventSlotOccupancy);
  const [occ, setOcc] = useState<EventOccupancy[]>([]);
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
    avail({ data: {
      event_id: eventId,
      empresa_account_id: empresa || null,
      sponsor_account_id: sponsor || null,
      empresa_user_id: empResp || null,
      sponsor_user_id: spResp || null,
    } })
      .then((r: any) => { if (!cancelled) setSlots(r.slots); }).catch(() => { if (!cancelled) setSlots([]); });
    return () => { cancelled = true; };
  }, [eventId, empresa, sponsor, empResp, spResp]);
  const fmt = (iso: string) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  const chosen = slots?.find((x) => x.iso === slotIso);
  useEffect(() => { if (chosen?.free && chosen.suggested_room) setRoom(chosen.suggested_room); }, [chosen]);
  const rescue = empresa && sponsor ? chosen?.talk_conflicts ?? [] : [];

  const busyIds = (side: MeetingSide) => new Set(preOcc?.[side === "empresa" ? "empresa_users" : "sponsor_users"] ?? []);
  const accountBusy = (party: Party, side: MeetingSide) => !!preOcc && !accountHasFreeResponsible(party, busyIds(side));
  const accountSlotLabel = (party: Party, side: MeetingSide) => {
    if (!preOcc) return "";
    const busy = busyIds(side);
    if (!accountHasFreeResponsible(party, busy)) return " · Equipo ocupado en ese slot";
    const ids = party.responsables.map((person) => person.profile_id);
    return ids.some((id) => busy.has(id)) ? " · Algunos responsables ocupados" : "";
  };
  const responsibleOccupancy = (side: MeetingSide, profileId: string) =>
    preOcc?.[side === "empresa" ? "empresa_responsables" : "sponsor_responsables"].find((person) => person.user_id === profileId);
  const roomLabel = (value: string | null) => value ? (/^mesa\b/i.test(value) ? value : `Mesa ${value}`) : "";
  const responsibleLabel = (person: Responsable, side: MeetingSide) => {
    const base = `${person.full_name}${person.role ? ` · ${person.role}` : ""}`;
    if (!preOcc) return base;
    const occupied = responsibleOccupancy(side, person.profile_id);
    return `${base}${occupied ? ` · Ocupado/a${occupied.room ? ` en ${roomLabel(occupied.room)}` : ""}` : " · Disponible"}`;
  };
  const automaticResponsibleName = (side: MeetingSide) => {
    const id = side === "empresa" ? chosen?.available_empresa_users[0] : chosen?.available_sponsor_users[0];
    return (side === "empresa" ? empRespList : spRespList).find((person) => person.profile_id === id)?.full_name ?? null;
  };

  async function submit() {
    if (!empresa || !sponsor) return toast.error("Elige empresa y solución");
    const empresaUserId = empResp || chosen?.available_empresa_users[0] || empParty?.user_id;
    const sponsorUserId = spResp || chosen?.available_sponsor_users[0] || spParty?.user_id;
    if (!empresaUserId || !sponsorUserId) return toast.error("La cuenta necesita un responsable activo para crear una reunión");
    const ep = empRespList.find((r) => r.profile_id === empresaUserId);
    const sp = spRespList.find((r) => r.profile_id === sponsorUserId);
    setBusy(true);
    try {
      const scheduledTime = resolveMeetingFormTime(slotIso, time, slots);
      await create({ data: {
        event_id: eventId,
        // The selected or first free responsable owns the meeting in their agenda.
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
        {parts?.empresas.map((party) => <option key={party.account_id} value={party.account_id} disabled={!party.user_id || accountBusy(party, "empresa")}>{party.name}{!party.user_id ? " · Sin responsable activo" : accountSlotLabel(party, "empresa")}</option>)}
      </select>
    </Field>
    {empresa && (
      <Field label="Responsable empresa (opcional)">
        <select value={empResp} onChange={(e) => setEmpResp(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
          <option value="">{empRespList.length === 0 ? "— Sin equipo registrado —" : "— Asignar automáticamente —"}</option>
          {empRespList.map((person) => <option key={person.profile_id} value={person.profile_id} disabled={!!responsibleOccupancy("empresa", person.profile_id)}>{responsibleLabel(person, "empresa")}</option>)}
        </select>
        {!empResp && automaticResponsibleName("empresa") && <p className="mt-1 text-[11px] text-muted-foreground">Se asignará a {automaticResponsibleName("empresa")}, que está libre.</p>}
      </Field>
    )}
  </>);
  const spBlock = (<>
    <Field label="Solución *">
      <select value={sponsor} onChange={(e) => setSponsor(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
        <option value="">— Selecciona solución —</option>
        {parts?.sponsors.map((party) => <option key={party.account_id} value={party.account_id} disabled={!party.user_id || accountBusy(party, "sponsor")}>{party.name}{!party.user_id ? " · Sin responsable activo" : accountSlotLabel(party, "sponsor")}</option>)}
      </select>
    </Field>
    {sponsor && (
      <Field label="Responsable solución (opcional)">
        <select value={spResp} onChange={(e) => setSpResp(e.target.value)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
          <option value="">{spRespList.length === 0 ? "— Sin equipo registrado —" : "— Asignar automáticamente —"}</option>
          {spRespList.map((person) => <option key={person.profile_id} value={person.profile_id} disabled={!!responsibleOccupancy("sponsor", person.profile_id)}>{responsibleLabel(person, "sponsor")}</option>)}
        </select>
        {!spResp && automaticResponsibleName("sponsor") && <p className="mt-1 text-[11px] text-muted-foreground">Se asignará a {automaticResponsibleName("sponsor")}, que está libre.</p>}
      </Field>
    )}
  </>);
  const pickSlot = (iso: string, suggestedRoom: string | null) => { setSlotIso(iso); setTime(""); setRoom(suggestedRoom ?? ""); };

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
                  const occupied = (empParty && accountBusy(empParty, "empresa")) || (spParty && accountBusy(spParty, "sponsor"));
                  return <option key={o.iso} value={o.iso} disabled={!!occupied}>Slot {i + 1} · {fmt(o.iso)}{occupied ? " · Equipo ocupado" : ""}</option>;
                })}
              </select>
              {preSlot && oneSide && <p className="mt-1 text-[11px] text-muted-foreground">En la otra lista solo podrás elegir cuentas con algún responsable libre en ese slot.</p>}
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
          {slots && !(empresa && sponsor) && <p className="text-[11px] text-muted-foreground">Elige un slot y después la {empresa ? "solución" : "empresa"}: solo podrás elegir cuentas con algún responsable libre en ese slot.</p>}
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
              {chosen?.suggested_room && <p className="mt-1 text-[11px] text-muted-foreground">Mesa libre sugerida para esta solución.</p>}
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
