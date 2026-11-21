import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, CalendarIcon, Eye, Send, ArrowLeft, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { listReminderRecipients, sendSelectionReminder } from "@/lib/selection-reminder.functions";
import { DEFAULT_REMINDER_BODY, DEFAULT_REMINDER_SUBJECT, personalizeReminder, type ReminderRecipient, type ReminderRole } from "@/lib/selection-reminder";

type DeliveryResult = { id: string; emailSent: boolean; notified: boolean; error: string };
type DeliveryInput = { userId: string; campaignId: string; role: ReminderRole; subject: string; body: string; date: string };

export function SelectionReminderModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const list = useServerFn(listReminderRecipients);
  const send = useServerFn(sendSelectionReminder);
  const [recipients, setRecipients] = useState<ReminderRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    list({ data: { eventId, role: "all" } }).then(people => { if (active) setRecipients(people); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "No se pudieron cargar los destinatarios"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId, reload]);
  return <ReminderComposer recipients={recipients} loading={loading} loadError={error} onReload={() => setReload(n => n + 1)} onClose={onClose} onSend={input => send({ data: { ...input, eventId } })} />;
}

export function ReminderComposer({ recipients, loading, loadError, onReload, onClose, onSend }: {
  recipients: ReminderRecipient[]; loading: boolean; loadError: string; onReload: () => void; onClose: () => void;
  onSend: (input: DeliveryInput) => Promise<DeliveryResult>;
}) {
  const [role, setRole] = useState<ReminderRole>("all");
  const [date, setDate] = useState<Date>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [subject, setSubject] = useState(DEFAULT_REMINDER_SUBJECT);
  const [body, setBody] = useState(DEFAULT_REMINDER_BODY);
  const [preview, setPreview] = useState(false);
  const [previewId, setPreviewId] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const campaign = useRef("");
  const [results, setResults] = useState<DeliveryResult[]>([]);
  const [processed, setProcessed] = useState(0);
  const [targetCount, setTargetCount] = useState(0);
  const audience = recipients.filter(person => role === "all" || person.role === role);
  const selected = audience.find(person => person.id === previewId) ?? audience[0];
  const locked = busy || results.length > 0;
  const dateKey = date ? format(date, "yyyy-MM-dd") : "";
  const canPreview = !loading && !loadError && audience.length > 0 && !!date && !!subject.trim() && !!body.trim();
  const failed = results.filter(r => !r.emailSent || !r.notified);

  async function deliver(retry = false) {
    if (busyRef.current || !canPreview || !preview) return;
    busyRef.current = true; setBusy(true); setProcessed(0);
    if (!campaign.current) campaign.current = crypto.randomUUID();
    const retryIds = new Set(failed.map(r => r.id));
    const targets = retry ? audience.filter(p => retryIds.has(p.id)) : audience;
    setTargetCount(targets.length);
    try {
      for (const person of targets) {
        let result: DeliveryResult;
        try { result = await onSend({ userId: person.id, campaignId: campaign.current, role, subject, body, date: dateKey }); }
        catch (e) { result = { id: person.id, emailSent: false, notified: false, error: e instanceof Error ? e.message : "No se pudo confirmar el envío" }; }
        setResults(previous => [...previous.filter(r => r.id !== person.id), result]);
        setProcessed(n => n + 1);
        // Keep batches interactive, respecting the existing email provider's pacing.
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } finally { busyRef.current = false; setBusy(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !busyRef.current) onClose(); }}>
    <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto" onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (busyRef.current) event.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Recordatorio de selecciones</DialogTitle>
        <DialogDescription>{preview ? "Vista previa del comunicado" : "Comunicado a participantes del evento"}</DialogDescription>
      </DialogHeader>
      {loadError && <div role="alert" className="text-sm text-destructive">{loadError} <Button variant="outline" size="sm" onClick={onReload}>Reintentar</Button></div>}
      <div className="space-y-4">
        <fieldset disabled={locked} className="space-y-4 disabled:opacity-70">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Destinatarios">
            {([{ value: "all", label: "Todos" }, { value: "empresa", label: "Empresas" }, { value: "sponsor", label: "Soluciones" }] as const).map(option => <Button key={option.value} size="sm" variant={role === option.value ? "default" : "outline"} aria-pressed={role === option.value} disabled={locked} onClick={() => { setRole(option.value); setPreview(false); }}>{option.label} ({recipients.filter(p => option.value === "all" || p.role === option.value).length})</Button>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{loading ? "Cargando destinatarios…" : `${audience.length} ${audience.length === 1 ? "persona destinataria" : "personas destinatarias"}`}</span>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger asChild><Button variant="outline" disabled={locked} aria-label="Seleccionar fecha límite"><CalendarIcon className="h-4 w-4" />{date ? format(date, "d MMMM yyyy", { locale: es }) : "Fecha límite"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar mode="single" {...(date ? { selected: date } : {})} locale={es} onSelect={value => { setDate(value); setCalendarOpen(false); setPreview(false); }} className="pointer-events-auto p-3" /></PopoverContent></Popover>
          </div>
          {!preview && <>
            <div className="space-y-2"><label htmlFor="reminder-subject" className="text-sm font-medium">Asunto</label><Input id="reminder-subject" maxLength={200} value={subject} onChange={e => setSubject(e.target.value)} /></div>
            <div className="space-y-2"><label htmlFor="reminder-body" className="text-sm font-medium">Mensaje</label><Textarea id="reminder-body" className="min-h-64" maxLength={10000} value={body} onChange={e => setBody(e.target.value)} /></div>
            <div className="flex flex-wrap gap-1">{["{nombre}", "{tipo_objetivo}", "{fecha}"].map(tag => <Button variant="outline" size="sm" key={tag} onClick={() => setBody(previous => previous + tag)}>{tag}</Button>)}</div>
          </>}
        </fieldset>
        {!loading && !loadError && audience.length === 0 && <p className="text-sm text-muted-foreground">No hay participantes inscritos de este tipo.</p>}
        {preview && selected && dateKey && <section className="space-y-3 border-t border-border pt-4">
          <Select value={selected.id} onValueChange={setPreviewId}><SelectTrigger aria-label="Previsualizar destinatario"><SelectValue /></SelectTrigger><SelectContent>{audience.map(person => <SelectItem key={person.id} value={person.id}>{person.name} · {person.role === "empresa" ? "Empresa" : "Solución"}</SelectItem>)}</SelectContent></Select>
          <div className="text-sm text-muted-foreground break-words">Para: {selected.email || "Sin correo electrónico"}</div>
          <h3 className="font-semibold break-words">{personalizeReminder(subject, selected, dateKey)}</h3>
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{personalizeReminder(body, selected, dateKey)}</div>
          <p className="text-xs text-muted-foreground">Correo electrónico y aviso en la plataforma · {audience.length} {audience.length === 1 ? "persona" : "personas"}</p>
        </section>}
        {(busy || results.length > 0) && <div className="space-y-2 border-t border-border pt-4" role="status" aria-live="polite">
          {busy && <><Progress value={Math.min(100, processed / Math.max(1, targetCount) * 100)} /><p className="text-sm">Enviando… {processed} de {targetCount}</p></>}
          <p className="text-sm font-medium">{results.filter(r => r.emailSent).length} {results.filter(r => r.emailSent).length === 1 ? "correo enviado" : "correos enviados"} · {results.filter(r => r.notified).length} {results.filter(r => r.notified).length === 1 ? "aviso" : "avisos"} en la plataforma</p>
          {!busy && failed.length > 0 && <div className="space-y-1 text-sm text-destructive"><p>{failed.length} destinatarios con incidencias</p>{failed.map(result => <p className="break-words" key={result.id}>{audience.find(p => p.id === result.id)?.name}: {result.error}</p>)}</div>}
          {!busy && results.length === audience.length && failed.length === 0 && <p className="text-sm text-primary">Envío completado</p>}
        </div>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" disabled={busy} onClick={onClose}>{results.length ? "Cerrar" : "Cancelar"}</Button>
          {!results.length && (preview ? <><Button variant="outline" disabled={busy} onClick={() => setPreview(false)}><ArrowLeft className="h-4 w-4" />Editar</Button><Button disabled={busy || !canPreview} onClick={() => void deliver()}><Send className="h-4 w-4" />{busy ? "Enviando…" : `Enviar a ${audience.length} ${audience.length === 1 ? "persona" : "personas"}`}</Button></> : <Button disabled={!canPreview} onClick={() => setPreview(true)}><Eye className="h-4 w-4" />Vista previa</Button>)}
          {results.length > 0 && !busy && failed.length > 0 && <Button onClick={() => void deliver(true)}><RotateCcw className="h-4 w-4" />Reintentar incidencias</Button>}
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}