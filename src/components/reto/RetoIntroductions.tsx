import { useCallback, useEffect, useMemo, useState } from "react";
import {
  retoDb, fetchMyIntroductions, createIntroduction, respondIntroduction, cancelIntroduction,
  introPickError, introSlotsLeft, introMissing, INTRO_MAX, INTRO_POINTS, type IntroRow,
} from "@/lib/reto";
import { Check, Clock, Handshake, Search, Sparkles, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

export type IntroPerson = {
  user_id: string;
  display_name: string;
  company_name: string | null;
  cargo?: string | null;
  photo_url: string | null;
};

const RULE =
  "Cuenta cuando las dos personas confirman la presentación y además se marcan «Hemos conectado» entre ellas. " +
  "Si alguien retira su confirmación o se deshace la conexión, vuelve a «pendiente» y se quitan los +40 hasta que se cumpla otra vez. " +
  "Si alguien la rechaza, se cierra.";

function useIntros(eventId: string) {
  const [rows, setRows] = useState<IntroRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setRows(await fetchMyIntroductions(eventId));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar las presentaciones");
    }
  }, [eventId]);
  useEffect(() => { reload(); }, [reload]);
  return { rows, error, reload };
}

function usePeople(eventId: string, given?: IntroPerson[]) {
  const [people, setPeople] = useState<IntroPerson[]>(given ?? []);
  useEffect(() => {
    if (given) { setPeople(given); return; }
    retoDb.from("reto_participants")
      .select("user_id, display_name, company_name, cargo, photo_url")
      .eq("event_id", eventId).order("display_name")
      .then(({ data }: any) => setPeople(data ?? []));
  }, [eventId, given]);
  return people;
}

function nameOf(map: Map<string, IntroPerson>, id: string) {
  const p = map.get(id);
  return p ? p.display_name : "Participante";
}

// ---------------------------------------------------------------------
// Presentador: elegir a dos personas y seguir sus presentaciones
// ---------------------------------------------------------------------

export function IntroducePanel({ eventId, me, enabled }: { eventId: string; me: string; enabled: boolean }) {
  const { rows, error, reload } = useIntros(eventId);
  const people = usePeople(eventId);
  const map = useMemo(() => new Map(people.map((p) => [p.user_id, p])), [people]);
  const candidates = useMemo(() => people.filter((p) => p.user_id !== me), [people, me]);
  const [p1, setP1] = useState<string | null>(null);
  const [p2, setP2] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mine = rows.filter((r) => r.introducer_id === me);
  const left = introSlotsLeft(rows, me);
  const validated = mine.filter((r) => r.awarded).length;

  async function submit() {
    const err = introPickError(me, p1, p2);
    if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      await createIntroduction(eventId, p1!, p2!);
      toast.success("Presentación enviada. Ahora las dos personas tienen que confirmarla.");
      setP1(null); setP2(null);
      await reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setBusy(true);
    try { await cancelIntroduction(id); toast("Presentación cancelada"); await reload(); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-primary/40 bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 font-bold"><UserPlus className="h-4 w-4 text-primary" /> ¡Te presento!</div>
        <div className="text-xs font-bold text-uppercase-wide text-muted-foreground">
          {validated}/{INTRO_MAX} validadas · +{validated * INTRO_POINTS}
        </div>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">{RULE}</p>
        {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{error}</div>}

        {!enabled ? (
          <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">La misión está desactivada ahora mismo.</div>
        ) : left === 0 ? (
          <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Ya tienes {INTRO_MAX} presentaciones en marcha o validadas. Cancela una pendiente si quieres hacer otra.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <PersonPicker label="Persona 1" people={candidates.filter((p) => p.user_id !== p2)} value={p1} onChange={setP1} map={map} />
              <PersonPicker label="Persona 2" people={candidates.filter((p) => p.user_id !== p1)} value={p2} onChange={setP2} map={map} />
            </div>
            <button disabled={busy || !p1 || !p2} onClick={submit}
              className="w-full rounded-lg bg-primary px-3 py-2.5 text-xs font-bold text-uppercase-wide text-primary-foreground disabled:opacity-50">
              Presentarles · te quedan {left}
            </button>
          </div>
        )}

        {mine.length > 0 && (
          <ul className="space-y-2">
            {mine.map((r) => {
              const miss = introMissing(r);
              return (
                <li key={r.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate font-bold">{nameOf(map, r.person_a)} <span className="text-muted-foreground">+</span> {nameOf(map, r.person_b)}</div>
                    <IntroBadge r={r} />
                  </div>
                  {r.status === "pending" && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <Step ok={!miss.includes("a")} label={`${nameOf(map, r.person_a)} confirma`} />
                      <Step ok={!miss.includes("b")} label={`${nameOf(map, r.person_b)} confirma`} />
                      <Step ok={!miss.includes("conexion")} label="Conectan entre sí" />
                      <button disabled={busy} onClick={() => cancel(r.id)} className="ml-auto font-bold underline disabled:opacity-50">Cancelar</button>
                    </div>
                  )}
                  {r.status === "validated" && !r.awarded && (
                    <div className="mt-1 text-xs text-muted-foreground">Validada, sin puntos (misión desactivada o la pareja ya había sido presentada).</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Step({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${ok ? "text-primary font-bold" : ""}`}>
      {ok ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />} {label}
    </span>
  );
}

function IntroBadge({ r }: { r: IntroRow }) {
  const base = "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide";
  if (r.status === "validated") return <span className={`${base} bg-primary text-primary-foreground`}>{r.awarded ? `+${INTRO_POINTS}` : "Validada"}</span>;
  if (r.status === "pending") return <span className={`${base} bg-muted`}>Pendiente</span>;
  if (r.status === "cancelled") return <span className={`${base} bg-muted text-muted-foreground`}>Cancelada</span>;
  return <span className={`${base} bg-muted text-muted-foreground`}>Rechazada</span>;
}

function PersonPicker({ label, people, value, onChange, map }: {
  label: string; people: IntroPerson[]; value: string | null; onChange: (v: string | null) => void; map: Map<string, IntroPerson>;
}) {
  const [q, setQ] = useState("");
  const selected = value ? map.get(value) : null;
  const term = q.trim().toLowerCase();
  const results = term
    ? people.filter((p) => `${p.display_name} ${p.company_name ?? ""}`.toLowerCase().includes(term)).slice(0, 6)
    : [];
  if (selected) {
    return (
      <div>
        <div className="mb-1 text-[10px] font-bold text-uppercase-wide text-muted-foreground">{label}</div>
        <div className="flex items-center gap-2 rounded-lg border border-primary bg-primary/5 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{selected.display_name}</div>
            <div className="truncate text-xs text-muted-foreground">{selected.company_name}</div>
          </div>
          <button aria-label={`Quitar ${selected.display_name}`} onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold text-uppercase-wide text-muted-foreground">{label}</div>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre o empresa…" aria-label={label}
          className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm" />
      </div>
      {results.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-lg border border-border bg-popover">
          {results.map((p) => (
            <li key={p.user_id}>
              <button onClick={() => { onChange(p.user_id); setQ(""); }} className="w-full px-3 py-2 text-left text-sm hover:bg-accent">
                <span className="font-bold">{p.display_name}</span>
                {p.company_name && <span className="text-muted-foreground"> · {p.company_name}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Personas presentadas: confirmar desde el álbum («Por confirmar»)
// ---------------------------------------------------------------------

export function IntroInbox({ eventId, me, people, iMarked, onChanged }: {
  eventId: string; me: string; people: IntroPerson[]; iMarked: (id: string) => boolean; onChanged: () => void;
}) {
  const { rows, reload } = useIntros(eventId);
  const map = useMemo(() => new Map(people.map((p) => [p.user_id, p])), [people]);
  const [busy, setBusy] = useState<string | null>(null);

  const forMe = rows.filter((r) => r.introducer_id !== me && (r.status === "pending" || r.status === "validated"));
  if (forMe.length === 0) return null;

  async function act(r: IntroRow, action: "confirm" | "withdraw" | "decline") {
    setBusy(r.id);
    try {
      await respondIntroduction(r.id, action);
      if (action === "confirm") {
        const other = r.person_a === me ? r.person_b : r.person_a;
        if (!iMarked(other)) {
          const { error } = await retoDb.from("reto_marks").insert({ event_id: eventId, from_user_id: me, to_user_id: other });
          if (error && error.code !== "23505") throw error;
        }
        toast.success("Confirmada y marcada vuestra conexión");
      } else if (action === "withdraw") {
        toast("Confirmación retirada");
      } else {
        toast("Presentación rechazada");
      }
      await reload();
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5">
      <div className="flex items-center gap-2 border-b border-primary/20 px-4 py-2 text-[10px] font-bold text-uppercase-wide text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Presentaciones por confirmar
      </div>
      <ul>
        {forMe.map((r) => {
          const other = r.person_a === me ? r.person_b : r.person_a;
          const iConfirmed = r.person_a === me ? r.a_confirmed : r.b_confirmed;
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 border-b border-primary/10 px-4 py-3 last:border-0">
              <Handshake className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1 text-sm">
                <b>{nameOf(map, r.introducer_id)}</b> te presenta a <b>{nameOf(map, other)}</b>
                {map.get(other)?.company_name && <span className="text-muted-foreground"> · {map.get(other)?.company_name}</span>}
                <div className="text-xs text-muted-foreground">
                  {r.status === "validated" ? "Validada" : iConfirmed ? "Has confirmado · falta la otra persona o vuestra conexión" : "Confirma si os han presentado de verdad"}
                </div>
              </div>
              {iConfirmed ? (
                <button disabled={busy === r.id} onClick={() => act(r, "withdraw")}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-uppercase-wide text-muted-foreground disabled:opacity-50">
                  Retirar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button disabled={busy === r.id} onClick={() => act(r, "decline")}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-uppercase-wide text-muted-foreground disabled:opacity-50">
                    No
                  </button>
                  <button disabled={busy === r.id} onClick={() => act(r, "confirm")}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-uppercase-wide text-primary-foreground disabled:opacity-50">
                    Confirmar
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
