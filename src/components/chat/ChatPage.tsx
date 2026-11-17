import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listChatDirectory, type ChatPerson } from "@/lib/chat.functions";
import { PageHeader } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";

interface Msg { id: string; sender_id: string; body: string; created_at: string; user_a: string; user_b: string }
type Tab = "chats" | "todos" | "empresa" | "sponsor";
const fmt = (d: string) => new Date(d).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const pair = (x: string, y: string) => (x < y ? [x, y] : [y, x]);
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function Avatar({ p }: { p: ChatPerson }) {
  const src = p.avatar || p.logo;
  return (
    <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-semibold">{p.name[0]}</span>}
    </div>
  );
}

export function ChatPage() {
  const fetchDir = useServerFn(listChatDirectory);
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("todos");
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const reload = async () => {
    try { const r = await fetchDir(); setPeople(r.people); if (r.people.some((p) => p.lastAt)) setTab((t) => t); } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
    const con = new URLSearchParams(window.location.search).get("con");
    if (con) setActive(con);
    reload();
  }, []);
  useEffect(() => { if (!loading && people.some((p) => p.lastAt)) setTab("chats"); }, [loading]);

  const person = useMemo(() => people.find((p) => p.userId === active) ?? null, [people, active]);
  const shown = useMemo(() => {
    const nq = norm(q.trim());
    return people.filter((p) => {
      if (tab === "chats" && !p.lastAt) return false;
      if ((tab === "empresa" || tab === "sponsor") && p.kind !== tab) return false;
      return !nq || norm(`${p.name} ${p.company} ${p.cargo ?? ""}`).includes(nq);
    });
  }, [people, tab, q]);
  const unreadTotal = people.reduce((s, p) => s + p.unread, 0);

  const markRead = async (pid: string) => {
    if (!me) return;
    await supabase.from("chat_dm_reads" as any).upsert({ user_id: me, partner_id: pid, last_read_at: new Date().toISOString() } as any);
    setPeople((ps) => ps.map((p) => (p.userId === pid ? { ...p, unread: 0 } : p)));
    window.dispatchEvent(new Event("chat-read"));
  };

  useEffect(() => {
    if (!active || !me) return;
    const [a, b] = pair(me, active);
    (async () => {
      const { data } = await supabase.from("chat_dm" as any).select("*").eq("user_a", a).eq("user_b", b).order("created_at", { ascending: true }).limit(500);
      setMsgs((data ?? []) as unknown as Msg[]);
      markRead(active);
    })();
  }, [active, me]);

  useEffect(() => {
    if (!me) return;
    const ch = supabase.channel(`dm-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_dm" }, (payload) => {
        const m = payload.new as Msg;
        if (m.user_a !== me && m.user_b !== me) return;
        const other = m.user_a === me ? m.user_b : m.user_a;
        if (other === active) {
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          markRead(other);
        }
        setPeople((ps) => ps.map((p) => p.userId === other ? { ...p, lastMessage: m.body, lastAt: m.created_at, unread: other === active || m.sender_id === me ? p.unread : p.unread + 1 } : p)
          .sort((x, y) => (y.lastAt ?? "").localeCompare(x.lastAt ?? "")));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active, me]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || !active || !me) return;
    const [a, b] = pair(me, active);
    setSending(true);
    const { data, error } = await supabase.from("chat_dm" as any).insert({ user_a: a, user_b: b, sender_id: me, body } as any).select().single();
    setSending(false);
    if (error) { toast.error("No se pudo enviar el mensaje"); return; }
    setText("");
    const m = data as unknown as Msg;
    setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    setPeople((ps) => ps.map((p) => (p.userId === active ? { ...p, lastMessage: body, lastAt: m.created_at } : p)));
  };

  if (loading) return <div className="text-sm text-muted-foreground">Cargando…</div>;

  const tabs: [Tab, string][] = [["chats", `Mis chats${unreadTotal ? ` (${unreadTotal})` : ""}`], ["todos", "Todos"], ["empresa", "Empresas"], ["sponsor", "Soluciones"]];

  return (
    <div className="space-y-6">
      <PageHeader title="Mensajes" subtitle="Escribe a cualquier participante del evento" />
      <div className="grid gap-4 md:grid-cols-[340px_1fr] min-h-[560px]">
        <div className={`rounded-xl border border-border bg-card overflow-hidden flex flex-col ${active ? "hidden md:flex" : ""}`}>
          <div className="p-3 space-y-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona, empresa o cargo…" className="pl-8" />
            </div>
            <div className="flex flex-wrap gap-1">
              {tabs.map(([k, l]) => (
                <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} className="h-7 text-xs" onClick={() => setTab(k)}>{l}</Button>
              ))}
            </div>
          </div>
          <div className="overflow-y-auto max-h-[65vh]">
            {shown.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">{tab === "chats" ? "Aún no tienes conversaciones. Busca a alguien en «Todos»." : "Sin resultados"}</div>}
            {shown.map((p) => (
              <button key={p.userId} onClick={() => setActive(p.userId)}
                className={`w-full text-left flex items-center gap-3 p-3 border-b border-border hover:bg-muted/50 ${active === p.userId ? "bg-muted" : ""}`}>
                <Avatar p={p} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{p.name}</span>
                    {p.unread > 0 && <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">{p.unread}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.lastMessage ?? [p.company, p.cargo].filter(Boolean).join(" · ")}
                  </div>
                  <div className="flex gap-1 mt-0.5">
                    <span className="text-[10px] rounded bg-muted px-1.5">{p.kind === "empresa" ? "Empresa" : "Solución"}</span>
                    {p.badge && <span className="text-[10px] rounded bg-primary/10 text-primary px-1.5">{p.badge}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className={`rounded-xl border border-border bg-card flex flex-col ${active ? "" : "hidden md:flex"}`}>
          {!person ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">Busca a un participante y empieza a conversar</div>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 border-b border-border">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActive(null)}><ArrowLeft className="h-4 w-4" /></Button>
                <Avatar p={person} />
                <div className="min-w-0">
                  <div className="font-semibold truncate">{person.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{[person.cargo, person.company].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[60vh]">
                {msgs.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Escribe el primer mensaje a {person.name}.</div>}
                {msgs.map((m) => {
                  const own = m.sender_id === me;
                  return (
                    <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${own ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                        <div className="text-[10px] opacity-70 mt-1 text-right">{fmt(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottom} />
              </div>
              <div className="p-3 border-t border-border flex gap-2">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={2} placeholder="Escribe un mensaje…"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <Button onClick={send} disabled={sending || !text.trim()}><Send className="h-4 w-4" /></Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
