import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listMyConversations, type ChatConversation } from "@/lib/chat.functions";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Msg { id: string; sender_id: string; body: string; created_at: string; empresa_account_id: string; sponsor_account_id: string }

const originLabel = { match: "Match", reunion: "Reunión 1:1", ambos: "Match · Reunión" } as const;
const fmt = (d: string) => new Date(d).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function ChatPage() {
  const fetchConvs = useServerFn(listMyConversations);
  const [convs, setConvs] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const reload = async () => {
    try { const r = await fetchConvs(); setConvs(r.conversations); } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); reload(); }, []);

  const conv = useMemo(() => convs.find((c) => c.partnerAccountId === active) ?? null, [convs, active]);

  const markRead = async (pid: string) => {
    if (!me) return;
    await supabase.from("chat_reads" as any).upsert({ user_id: me, partner_account_id: pid, last_read_at: new Date().toISOString() } as any);
    setConvs((cs) => cs.map((c) => (c.partnerAccountId === pid ? { ...c, unread: 0 } : c)));
  };

  useEffect(() => {
    if (!conv) return;
    (async () => {
      const { data } = await supabase.from("chat_messages" as any).select("*")
        .eq("empresa_account_id", conv.empresaAccountId).eq("sponsor_account_id", conv.sponsorAccountId)
        .order("created_at", { ascending: true }).limit(500);
      const list = (data ?? []) as unknown as Msg[];
      setMsgs(list);
      const ids = [...new Set(list.map((m) => m.sender_id))];
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        setNames((n) => ({ ...n, ...Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.full_name ?? ""])) }));
      }
      markRead(conv.partnerAccountId);
    })();
  }, [conv?.partnerAccountId]);

  // Realtime: new messages for any of my conversations
  useEffect(() => {
    const ch = supabase.channel(`chat-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async (payload) => {
        const m = payload.new as Msg;
        const isActive = conv && m.empresa_account_id === conv.empresaAccountId && m.sponsor_account_id === conv.sponsorAccountId;
        if (isActive) {
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (!names[m.sender_id]) {
            const { data: p } = await supabase.from("profiles").select("full_name").eq("id", m.sender_id).maybeSingle();
            setNames((n) => ({ ...n, [m.sender_id]: p?.full_name ?? "" }));
          }
          markRead(conv!.partnerAccountId);
        } else reload();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conv?.partnerAccountId, me]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || !conv || !me) return;
    setSending(true);
    const { data, error } = await supabase.from("chat_messages" as any).insert({
      empresa_account_id: conv.empresaAccountId, sponsor_account_id: conv.sponsorAccountId, sender_id: me, body,
    } as any).select().single();
    setSending(false);
    if (error) { toast.error("No se pudo enviar el mensaje"); return; }
    setText("");
    setMsgs((prev) => (prev.some((x) => x.id === (data as any).id) ? prev : [...prev, data as unknown as Msg]));
    setConvs((cs) => cs.map((c) => (c.partnerAccountId === conv.partnerAccountId ? { ...c, lastMessage: body, lastAt: new Date().toISOString() } : c)));
  };

  if (loading) return <div className="text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Mensajes" subtitle="Chat privado con las cuentas con las que tienes match o reunión 1:1" />
      {convs.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Aún no tienes conversaciones" hint="Podrás escribir cuando tengas un match mutuo o una reunión 1:1 asignada." />
      ) : (
        <div className="grid gap-4 md:grid-cols-[300px_1fr] min-h-[560px]">
          <div className={`rounded-xl border border-border bg-card overflow-hidden ${active ? "hidden md:block" : ""}`}>
            {convs.map((c) => (
              <button key={c.partnerAccountId} onClick={() => setActive(c.partnerAccountId)}
                className={`w-full text-left flex items-center gap-3 p-3 border-b border-border hover:bg-muted/50 ${active === c.partnerAccountId ? "bg-muted" : ""}`}>
                <div className="h-10 w-10 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {c.partnerLogo ? <img src={c.partnerLogo} alt="" className="h-full w-full object-contain" /> : <span className="text-sm font-semibold">{c.partnerName[0]}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{c.partnerName}</span>
                    {c.unread > 0 && <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">{c.unread}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{c.lastMessage ?? originLabel[c.origin]}</div>
                </div>
              </button>
            ))}
          </div>
          <div className={`rounded-xl border border-border bg-card flex flex-col ${active ? "" : "hidden md:flex"}`}>
            {!conv ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">Elige una conversación</div>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 border-b border-border">
                  <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActive(null)}><ArrowLeft className="h-4 w-4" /></Button>
                  <div className="font-semibold">{conv.partnerName}</div>
                  <span className="text-[10px] text-uppercase-wide text-muted-foreground">{originLabel[conv.origin]}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[60vh]">
                  {msgs.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Escribe el primer mensaje para coordinar vuestra reunión.</div>}
                  {msgs.map((m) => {
                    const own = m.sender_id === me;
                    return (
                      <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${own ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {!own && <div className="text-[11px] font-semibold opacity-80">{names[m.sender_id] || "—"}</div>}
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
      )}
    </div>
  );
}
