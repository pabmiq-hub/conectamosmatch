import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createBulletin, updateBulletin } from "@/lib/admin-bulletin.functions";

export function BulletinModal({ events, post, onClose, onSaved }: { events: { id: string; title: string }[]; post: any | null; onClose: () => void; onSaved: () => void }) {
  const create = useServerFn(createBulletin);
  const update = useServerFn(updateBulletin);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<"global" | "event">("global");
  const [eventId, setEventId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (post) {
      setScope(post.scope ?? "global");
      setEventId(post.event_id ?? "");
      setTitle(post.title ?? "");
      setContent(post.content ?? "");
    }
  }, [post]);

  async function submit() {
    if (!content.trim()) return toast.error("El contenido es obligatorio");
    if (scope === "event" && !eventId) return toast.error("Selecciona un evento");
    setBusy(true);
    try {
      const payload = { scope, event_id: scope === "event" ? eventId : null, title: title || null, content };
      if (post?.id) {
        await update({ data: { id: post.id, patch: payload } });
        toast.success("Anuncio actualizado");
      } else {
        await create({ data: payload });
        toast.success("Anuncio publicado");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-lg font-bold text-uppercase-wide">{post ? "Editar anuncio" : "Nuevo anuncio"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <L>Alcance</L>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["global", "event"] as const).map((s) => (
                <button key={s} onClick={() => setScope(s)} className={`rounded-md border px-3 py-2 text-xs font-bold text-uppercase-wide ${scope === s ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                  {s === "global" ? "Global" : "Por evento"}
                </button>
              ))}
            </div>
          </div>
          {scope === "event" && (
            <div>
              <L>Evento</L>
              <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
                <option value="">— Selecciona —</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
          )}
          <div>
            <L>Título (opcional)</L>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div>
            <L>Contenido *</L>
            <textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-md border border-border py-2.5 text-sm font-bold text-uppercase-wide">Cancelar</button>
            <button onClick={submit} disabled={busy} className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
              {busy ? "Guardando…" : "Publicar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function L({ children }: { children: React.ReactNode }) {
  return <label className="text-xs text-uppercase-wide text-muted-foreground">{children}</label>;
}
