import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Megaphone, Plus, Edit3, Trash2, Globe, Calendar } from "lucide-react";
import { toast } from "sonner";
import { listBulletin, deleteBulletin } from "@/lib/admin-bulletin.functions";
import { listEvents } from "@/lib/admin-events.functions";
import { BulletinModal } from "@/components/admin/BulletinModal";

export const Route = createFileRoute("/_authenticated/admin/tablon")({
  component: AdminTablon,
});

function AdminTablon() {
  const list = useServerFn(listBulletin);
  const listEv = useServerFn(listEvents);
  const del = useServerFn(deleteBulletin);
  const [posts, setPosts] = useState<any[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [scope, setScope] = useState<"all" | "global" | "event">("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [show, setShow] = useState(false);

  async function load() {
    try { const r = await list({ data: { scope, event_id: null } }); setPosts(r.posts); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  useEffect(() => { load(); }, [scope]);
  useEffect(() => {
    (async () => {
      try { const r = await listEv({ data: undefined as any }); setEvents(r.events.map((e: any) => ({ id: e.id, title: e.title }))); }
      catch {}
    })();
  }, []);

  const eventTitle = (id: string | null) => events.find((e) => e.id === id)?.title ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader title="Tablón de anuncios" subtitle="Avisos globales o por evento" right={
        <button onClick={() => { setEditing(null); setShow(true); }} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide">
          <Plus className="h-4 w-4" /> Nuevo anuncio
        </button>
      } />
      {show && <BulletinModal events={events} post={editing} onClose={() => setShow(false)} onSaved={load} />}

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "global", "event"] as const).map((s) => (
          <button key={s} onClick={() => setScope(s)} className={`rounded-full border px-3 py-1.5 text-xs font-bold text-uppercase-wide ${scope === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
            {s === "all" ? "Todos" : s === "global" ? "Globales" : "Por evento"}
          </button>
        ))}
      </div>

      {posts.length === 0 ? <EmptyState icon={Megaphone} title="Sin anuncios" /> : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide ${p.scope === "global" ? "bg-primary/15 text-primary" : "bg-muted"}`}>
                      {p.scope === "global" ? <><Globe className="h-3 w-3" /> Global</> : <><Calendar className="h-3 w-3" /> {eventTitle(p.event_id)}</>}
                    </span>
                  </div>
                  {p.title && <div className="font-display text-sm font-bold mb-1">{p.title}</div>}
                  <div className="text-sm whitespace-pre-wrap">{p.content}</div>
                  <div className="mt-2 text-[10px] text-uppercase-wide text-muted-foreground">{new Date(p.created_at).toLocaleString("es-ES")}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => { setEditing(p); setShow(true); }} className="p-1.5 text-muted-foreground hover:text-foreground"><Edit3 className="h-4 w-4" /></button>
                  <button onClick={async () => {
                    if (!window.confirm("¿Eliminar anuncio?")) return;
                    try { await del({ data: { id: p.id } }); toast.success("Eliminado"); load(); }
                    catch (e: any) { toast.error(e?.message ?? "Error"); }
                  }} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
