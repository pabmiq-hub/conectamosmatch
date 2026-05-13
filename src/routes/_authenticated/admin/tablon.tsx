import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Megaphone, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/tablon")({
  component: AdminTablon,
});

function AdminTablon() {
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("bulletin_posts").select("*").order("created_at", { ascending: false });
    setPosts(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function publish() {
    if (!content.trim()) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: ev } = await supabase.from("events").select("id").in("status", ["published","ongoing"]).limit(1).maybeSingle();
    const { error } = await supabase.from("bulletin_posts").insert({ content, author_id: user?.id, event_id: ev?.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    setContent(""); toast.success("Anuncio publicado"); load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tablón de anuncios" subtitle="Publica avisos para todos los participantes del evento" />
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="Escribe un anuncio para todos los asistentes..." className="w-full rounded-md border border-border bg-background p-3 text-sm" />
        <div className="flex justify-end">
          <button onClick={publish} disabled={busy || !content.trim()} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
            <Send className="h-3 w-3" /> Publicar
          </button>
        </div>
      </div>
      {posts.length === 0 ? <EmptyState icon={Megaphone} title="Aún no hay anuncios" /> : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm">{p.content}</div>
              <div className="mt-2 text-[10px] text-uppercase-wide text-muted-foreground">{new Date(p.created_at).toLocaleString("es-ES")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
