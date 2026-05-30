import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createEvent, updateEvent } from "@/lib/admin-events.functions";

type EventStatus = "draft" | "published" | "ongoing" | "finished" | "cancelled";

export function EventModal({ event, onClose, onSaved }: { event: any | null; onClose: () => void; onSaved: () => void }) {
  const create = useServerFn(createEvent);
  const update = useServerFn(updateEvent);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: "",
    slug: "",
    description: "",
    status: "draft" as EventStatus,
    event_date: "",
    end_date: "",
    location_name: "",
    location_address: "",
    location_city: "",
    is_virtual: false,
    virtual_url: "",
    cover_image_url: "",
    max_empresas: "",
    max_sponsors: "",
    rooms: ["Sala A"] as string[],
    meetings_per_user: 8,
    slot_duration_minutes: 15,
    meetings_start_at: "",
    meetings_end_at: "",
    max_likes_per_user: 20,
  });
  const [newRoom, setNewRoom] = useState("");

  useEffect(() => {
    if (event) {
      setF({
        title: event.title ?? "",
        slug: event.slug ?? "",
        description: event.description ?? "",
        status: event.status ?? "draft",
        event_date: event.event_date ? new Date(event.event_date).toISOString().slice(0, 16) : "",
        end_date: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : "",
        location_name: event.location_name ?? "",
        location_address: event.location_address ?? "",
        location_city: event.location_city ?? "",
        is_virtual: !!event.is_virtual,
        virtual_url: event.virtual_url ?? "",
        cover_image_url: event.cover_image_url ?? "",
        max_empresas: event.max_empresas?.toString() ?? "",
        max_sponsors: event.max_sponsors?.toString() ?? "",
        rooms: event.rooms?.length ? event.rooms : ["Sala A"],
        meetings_per_user: event.meetings_per_user ?? 8,
        slot_duration_minutes: event.slot_duration_minutes ?? 15,
        meetings_start_at: event.meetings_start_at ? new Date(event.meetings_start_at).toISOString().slice(0, 16) : "",
        meetings_end_at: event.meetings_end_at ? new Date(event.meetings_end_at).toISOString().slice(0, 16) : "",
        max_likes_per_user: event.max_likes_per_user ?? 20,
      });
    }
  }, [event]);

  const set = (k: keyof typeof f, v: any) => setF((p) => ({ ...p, [k]: v }));

  function addRoom() {
    if (!newRoom.trim()) return;
    set("rooms", [...f.rooms, newRoom.trim()]);
    setNewRoom("");
  }
  function removeRoom(i: number) {
    if (f.rooms.length <= 1) return;
    set("rooms", f.rooms.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!f.title.trim()) return toast.error("El título es obligatorio");
    setBusy(true);
    try {
      const payload = {
        title: f.title,
        slug: f.slug || null,
        description: f.description,
        status: f.status,
        event_date: f.event_date ? new Date(f.event_date).toISOString() : null,
        end_date: f.end_date ? new Date(f.end_date).toISOString() : null,
        location_name: f.location_name,
        location_address: f.location_address,
        location_city: f.location_city,
        is_virtual: f.is_virtual,
        virtual_url: f.virtual_url,
        cover_image_url: f.cover_image_url,
        max_empresas: f.max_empresas ? parseInt(f.max_empresas) : null,
        max_sponsors: f.max_sponsors ? parseInt(f.max_sponsors) : null,
        rooms: f.rooms,
        meetings_per_user: f.meetings_per_user,
        slot_duration_minutes: f.slot_duration_minutes,
        meetings_start_at: f.meetings_start_at ? new Date(f.meetings_start_at).toISOString() : null,
        meetings_end_at: f.meetings_end_at ? new Date(f.meetings_end_at).toISOString() : null,
        max_likes_per_user: f.max_likes_per_user,
      };
      if (event?.id) {
        await update({ data: { id: event.id, patch: payload } });
        toast.success("Evento actualizado");
      } else {
        await create({ data: payload });
        toast.success("Evento creado");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-lg font-bold text-uppercase-wide">{event ? "Editar evento" : "Nuevo evento"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5">
          <Section title="Datos básicos">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Título *" value={f.title} onChange={(v) => set("title", v)} />
              <Field label="Slug" value={f.slug} onChange={(v) => set("slug", v)} placeholder="evento-2026" />
              <div className="md:col-span-2">
                <Label>Descripción</Label>
                <textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
              </div>
              <Select label="Estado" value={f.status} onChange={(v) => set("status", v)} options={["draft", "published", "ongoing", "finished", "cancelled"]} />
              <Field label="Imagen de portada (URL)" value={f.cover_image_url} onChange={(v) => set("cover_image_url", v)} />
            </div>
          </Section>

          <Section title="Fechas y ubicación">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Inicio" type="datetime-local" value={f.event_date} onChange={(v) => set("event_date", v)} />
              <Field label="Fin" type="datetime-local" value={f.end_date} onChange={(v) => set("end_date", v)} />
              <Field label="Recinto" value={f.location_name} onChange={(v) => set("location_name", v)} />
              <Field label="Ciudad" value={f.location_city} onChange={(v) => set("location_city", v)} />
              <div className="md:col-span-2">
                <Field label="Dirección" value={f.location_address} onChange={(v) => set("location_address", v)} />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={f.is_virtual} onChange={(e) => set("is_virtual", e.target.checked)} /> Evento virtual
              </label>
              {f.is_virtual && <Field label="URL virtual" value={f.virtual_url} onChange={(v) => set("virtual_url", v)} />}
            </div>
          </Section>

          <Section title="Capacidad y selección">
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Máx. empresas" type="number" value={f.max_empresas} onChange={(v) => set("max_empresas", v)} />
              <Field label="Máx. soluciones" type="number" value={f.max_sponsors} onChange={(v) => set("max_sponsors", v)} />
              <div>
                <Label>Likes máx. por participante</Label>
                <input type="number" min={1} max={500} value={f.max_likes_per_user} onChange={(e) => set("max_likes_per_user", parseInt(e.target.value) || 20)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
              </div>
            </div>
          </Section>

          <Section title="Reuniones 1 a 1">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Reuniones por usuario</Label>
                <input type="number" min={1} max={50} value={f.meetings_per_user} onChange={(e) => set("meetings_per_user", parseInt(e.target.value) || 8)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Duración del slot (min)</Label>
                <input type="number" min={5} max={180} value={f.slot_duration_minutes} onChange={(e) => set("slot_duration_minutes", parseInt(e.target.value) || 15)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
              </div>
              <Field label="Inicio ventana reuniones" type="datetime-local" value={f.meetings_start_at} onChange={(v) => set("meetings_start_at", v)} />
              <Field label="Fin ventana reuniones" type="datetime-local" value={f.meetings_end_at} onChange={(v) => set("meetings_end_at", v)} />
            </div>
            <div className="mt-4">
              <Label>Salas disponibles</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {f.rooms.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs">
                    {r}
                    {f.rooms.length > 1 && <button onClick={() => removeRoom(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input value={newRoom} onChange={(e) => setNewRoom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRoom())} placeholder="Nueva sala" className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm" />
                <button onClick={addRoom} type="button" className="inline-flex items-center gap-1 rounded-md border border-border px-3 text-xs font-bold text-uppercase-wide"><Plus className="h-3 w-3" /> Añadir</button>
              </div>
            </div>
          </Section>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-md border border-border py-2.5 text-sm font-bold text-uppercase-wide">Cancelar</button>
            <button onClick={submit} disabled={busy} className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50">
              {busy ? "Guardando…" : event ? "Guardar cambios" : "Crear evento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <h3 className="font-display text-xs font-bold text-uppercase-wide text-muted-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs text-uppercase-wide text-muted-foreground">{children}</label>;
}
function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
    </div>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: any) => void; options: string[] }) {
  return (
    <div>
      <Label>{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
