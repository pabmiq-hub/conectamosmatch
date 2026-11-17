import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Live count of unread direct messages for the signed-in person. */
export function useUnreadMessages() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let me: string | null = null;
    let alive = true;
    const load = async () => {
      if (!me) me = (await supabase.auth.getUser()).data.user?.id ?? null;
      if (!me) return;
      const [msgs, reads] = await Promise.all([
        supabase.from("chat_dm" as any).select("user_a, user_b, sender_id, created_at").or(`user_a.eq.${me},user_b.eq.${me}`).neq("sender_id", me).order("created_at", { ascending: false }).limit(1000),
        supabase.from("chat_dm_reads" as any).select("partner_id, last_read_at").eq("user_id", me),
      ]);
      const lr = new Map<string, string>(((reads.data as any[]) ?? []).map((r) => [r.partner_id, r.last_read_at]));
      const n = ((msgs.data as any[]) ?? []).filter((m) => { const r = lr.get(m.sender_id); return !r || m.created_at > r; }).length;
      if (alive) setCount(n);
    };
    load();
    const onRead = () => load();
    window.addEventListener("chat-read", onRead);
    const ch = supabase.channel(`unread-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_dm" }, () => load())
      .subscribe();
    return () => { alive = false; window.removeEventListener("chat-read", onRead); supabase.removeChannel(ch); };
  }, []);
  return count;
}
