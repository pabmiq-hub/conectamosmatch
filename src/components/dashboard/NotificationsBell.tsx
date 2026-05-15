import { useEffect, useRef, useState } from "react";
import { Bell, Heart, MessageSquare, Calendar, Megaphone, Sparkles, Check } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Notif = {
  id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  link: string | null;
  is_read: boolean | null;
  created_at: string | null;
};

const ICON: Record<string, typeof Bell> = {
  new_match: Sparkles,
  like_received: Heart,
  new_message: MessageSquare,
  meeting_assigned: Calendar,
  meeting_updated: Calendar,
  bulletin_new: Megaphone,
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(15);
      setItems(data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`notif-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload: any) => {
        const n = payload.new as Notif;
        setItems((prev) => [n, ...prev].slice(0, 15));
        if (n.type === "new_match") {
          toast.success(n.title ?? "¡Nuevo match!", { description: "Ya puedes escribirle desde Mensajes" });
        } else if (n.type === "new_message") {
          toast(n.title ?? "Nuevo mensaje", { description: n.body ?? "" });
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unread = items.filter((i) => !i.is_read).length;

  async function openOne(n: Notif) {
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    setOpen(false);
    if (n.link) navigate({ to: n.link as any });
  }

  async function markAll() {
    if (!userId || unread === 0) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-md p-2 hover:bg-muted" aria-label="Notificaciones">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-display text-xs font-bold text-uppercase-wide">Notificaciones</span>
            {unread > 0 && (
              <button onClick={markAll} className="inline-flex items-center gap-1 text-[10px] text-uppercase-wide font-bold text-muted-foreground hover:text-foreground">
                <Check className="h-3 w-3" /> Marcar leídas
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No tienes notificaciones</div>
          ) : (
            <ul>
              {items.map((n) => {
                const Icon = ICON[n.type ?? ""] ?? Bell;
                return (
                  <li key={n.id}>
                    <button onClick={() => openOne(n)} className={`w-full text-left flex gap-3 px-4 py-3 border-b border-border hover:bg-muted ${!n.is_read ? "bg-primary/5" : ""}`}>
                      <div className={`mt-0.5 h-7 w-7 rounded-md flex items-center justify-center ${!n.is_read ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-semibold truncate">{n.title}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                        </div>
                        {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                      </div>
                      {!n.is_read && <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
