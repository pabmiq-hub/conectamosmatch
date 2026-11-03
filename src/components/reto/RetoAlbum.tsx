import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { retoDb, connectionStatus, getMyActiveRetoEvent, type RetoStatus } from "@/lib/reto";
import { Check, Clock, Handshake, Search, Sparkles, Trophy, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { RetoProgress } from "./RetoProgress";

type Participant = {
  user_id: string;
  display_name: string;
  cargo: string | null;
  company_name: string | null;
  photo_url: string | null;
  participant_type: "drh" | "sponsor";
};

type Filter = "todos" | RetoStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "sin_conectar", label: "Sin conectar" },
  { key: "por_confirmar", label: "Por confirmar" },
  { key: "esperando", label: "Esperando" },
  { key: "validada", label: "Validadas" },
];

export function RetoAlbum() {
  const [me, setMe] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<Participant[]>([]);
  const [out, setOut] = useState<Set<string>>(new Set());
  const [inc, setInc] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("todos");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [collective, setCollective] = useState<number | null>(null);

  async function loadCollective(ev: string) {
    const { data, error } = await retoDb.rpc("reto_connection_count", { _event: ev });
    if (!error) setCollective(Number(data) || 0);
  }

  async function loadMarks(ev: string, uid: string) {
    const { data, error } = await retoDb
      .from("reto_marks")
      .select("from_user_id, to_user_id")
      .eq("event_id", ev)
      .or(`from_user_id.eq.${uid},to_user_id.eq.${uid}`);
    if (error) throw error;
    const o = new Set<string>();
    const i = new Set<string>();
    for (const m of data ?? []) {
      if (m.from_user_id === uid) o.add(m.to_user_id);
      if (m.to_user_id === uid) i.add(m.from_user_id);
    }
    setOut(o);
    setInc(i);
    loadCollective(ev).catch(() => {});
  }

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setMe(user.id);
        const ev = await getMyActiveRetoEvent(user.id);
        setEventId(ev);
        if (!ev) return;
        const { data: ps, error } = await retoDb
          .from("reto_participants")
          .select("user_id, display_name, cargo, company_name, photo_url, participant_type")
          .eq("event_id", ev)
          .neq("user_id", user.id)
          .order("display_name");
        if (error) throw error;
        setPeople(ps ?? []);
        await loadMarks(ev, user.id);
      } catch (e: any) {
        toast.error(e?.message ?? "No se pudo cargar el álbum");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Keep incoming marks in sync while the album is open
  useEffect(() => {
    if (!eventId || !me) return;
    const ch = supabase
      .channel(`reto-marks-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reto_marks", filter: `event_id=eq.${eventId}` }, () => {
        loadMarks(eventId, me).catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId, me]);

  const withStatus = useMemo(
    () => people.map((p) => ({ ...p, status: connectionStatus(out.has(p.user_id), inc.has(p.user_id)) })),
    [people, out, inc],
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { todos: withStatus.length, sin_conectar: 0, por_confirmar: 0, esperando: 0, validada: 0 };
    for (const p of withStatus) c[p.status]++;
    return c;
  }, [withStatus]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return withStatus.filter((p) =>
      (filter === "todos" || p.status === filter) &&
      (!term || `${p.display_name} ${p.company_name ?? ""} ${p.cargo ?? ""}`.toLowerCase().includes(term)),
    );
  }, [withStatus, filter, q]);

  async function toggle(p: Participant) {
    if (!eventId || !me) return;
    setBusy(p.user_id);
    const marked = out.has(p.user_id);
    try {
      if (marked) {
        const { error } = await retoDb.from("reto_marks").delete()
          .eq("event_id", eventId).eq("from_user_id", me).eq("to_user_id", p.user_id);
        if (error) throw error;
        toast("Conexión retirada");
      } else {
        const { error } = await retoDb.from("reto_marks")
          .insert({ event_id: eventId, from_user_id: me, to_user_id: p.user_id });
        if (error && error.code !== "23505") throw error;
        toast.success(inc.has(p.user_id) ? `¡Conexión validada con ${p.display_name}!` : "Marcado. Falta que te confirme.");
      }
      await loadMarks(eventId, me);
    } catch (e: any) {
      toast.error(e?.message?.includes("row-level security") ? "El Reto no está abierto ahora mismo." : (e?.message ?? "Error"));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="text-xs text-muted-foreground text-uppercase-wide">Cargando álbum…</div>;

  if (!eventId) {
    return <EmptyState icon={Trophy} title="El Reto 2.700 no está activo" hint="Aparecerá aquí cuando empiece el evento." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mi álbum"
        subtitle="Marca «Hemos conectado» con cada persona con la que hables. Cuenta cuando los dos os marcáis."
        right={
          <div className="flex items-center gap-2 rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-xs font-bold text-uppercase-wide text-primary">
            <Handshake className="h-4 w-4" /> {counts.validada} conexión{counts.validada === 1 ? "" : "es"}
          </div>
        }
      />

      {collective !== null && <RetoProgress value={collective} />}

      {counts.por_confirmar > 0 && filter !== "por_confirmar" && (
        <button onClick={() => setFilter("por_confirmar")}
          className="w-full flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-left text-sm">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span><b>{counts.por_confirmar}</b> persona{counts.por_confirmar === 1 ? " te ha" : "s te han"} marcado. Confírmalas para sumar.</span>
        </button>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, empresa o cargo…"
          className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2.5 text-sm" />
      </div>

      <div className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-1 md:mx-0 md:px-0 md:flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold text-uppercase-wide transition-colors ${
              filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-accent"
            }`}>
            {f.label} <span className="opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={UserCheck} title="Nadie en esta lista" hint="Prueba con otro filtro o búsqueda." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <li key={p.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center font-display text-sm font-bold">
                {p.photo_url ? <img src={p.photo_url} alt={p.display_name} className="h-full w-full object-cover" />
                  : p.display_name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{p.display_name}</div>
                <div className="truncate text-xs text-muted-foreground">{[p.cargo, p.company_name].filter(Boolean).join(" · ")}</div>
                <StatusTag status={p.status} />
              </div>
              <button disabled={busy === p.user_id} onClick={() => toggle(p)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-uppercase-wide transition-colors disabled:opacity-50 ${
                  out.has(p.user_id)
                    ? "border border-border bg-background text-muted-foreground hover:text-foreground"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }`}>
                {out.has(p.user_id) ? "Desmarcar" : p.status === "por_confirmar" ? "Confirmar" : "Hemos conectado"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusTag({ status }: { status: RetoStatus }) {
  if (status === "validada")
    return <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary"><Check className="h-3 w-3" /> Validada</span>;
  if (status === "por_confirmar")
    return <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-foreground"><Sparkles className="h-3 w-3" /> Te ha marcado</span>;
  if (status === "esperando")
    return <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" /> Esperando respuesta</span>;
  return null;
}
