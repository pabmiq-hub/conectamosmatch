import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { MessageSquare, Send, Building2 } from "lucide-react";

interface ConvPartner { id: string; name: string; logo: string | null; }

export function MensajesPanel({ partnerTable }: { partnerTable: "empresa_profiles" | "sponsor_profiles" }) {
  const [me, setMe] = useState<string | null>(null);
  const [partners, setPartners] = useState<ConvPartner[]>([]);
  const [active, setActive] = useState<ConvPartner | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMe(user.id);
      const { data: msgs } = await supabase.from("messages").select("from_user_id, to_user_id").or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
      const partnerIds = Array.from(new Set((msgs ?? []).map((m: any) => m.from_user_id === user.id ? m.to_user_id : m.from_user_id).filter(Boolean)));
      const { data: parts } = await supabase.from(partnerTable).select("user_id, company_name, logo_url").in("user_id", partnerIds.length ? partnerIds : ["00000000-0000-0000-0000-000000000000"]);
      setPartners((parts ?? []).map((p: any) => ({ id: p.user_id, name: p.company_name, logo: p.logo_url })));
    })();
  }, [partnerTable]);

  useEffect(() => {
    if (!active || !me) return;
    (async () => {
      const { data } = await supabase.from("messages").select("*")
        .or(`and(from_user_id.eq.${me},to_user_id.eq.${active.id}),and(from_user_id.eq.${active.id},to_user_id.eq.${me})`)
        .order("created_at");
      setMessages(data ?? []);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    })();
    const ch = supabase.channel(`msg-${me}-${active.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
        const m = payload.new;
        if ((m.from_user_id === me && m.to_user_id === active.id) || (m.from_user_id === active.id && m.to_user_id === me)) {
          setMessages((prev) => [...prev, m]);
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active, me]);

  async function send() {
    if (!text.trim() || !me || !active) return;
    const content = text.trim();
    setText("");
    await supabase.from("messages").insert({ from_user_id: me, to_user_id: active.id, content });
  }

  return (
    <div className="space-y-6 h-[calc(100vh-12rem)] flex flex-col">
      <PageHeader title="Mensajes" subtitle="Conversaciones con tus matches" />
      <div className="flex-1 grid gap-4 md:grid-cols-[280px_1fr] min-h-0">
        <div className="rounded-xl border border-border bg-card overflow-y-auto">
          {partners.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Aún no tienes conversaciones. Haz match para empezar a chatear.</div>
          ) : partners.map((p) => (
            <button key={p.id} onClick={() => setActive(p)} className={`w-full flex items-center gap-3 p-3 border-b border-border hover:bg-muted text-left ${active?.id === p.id ? "bg-muted" : ""}`}>
              <div className="h-9 w-9 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                {p.logo ? <img src={p.logo} className="max-h-full max-w-full" alt="" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
              </div>
              <span className="text-xs font-medium truncate">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card flex flex-col min-h-0">
          {!active ? <EmptyState icon={MessageSquare} title="Selecciona una conversación" /> : (
            <>
              <div className="px-4 py-3 border-b border-border font-display text-xs text-uppercase-wide font-bold">{active.name}</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${m.from_user_id === me ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {m.content}
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="p-3 border-t border-border flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escribe un mensaje..." className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
                <button onClick={send} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Send className="h-3 w-3" /></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
