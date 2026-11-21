import { ArrowDownLeft, ArrowUpRight, Building2, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { ParticipantSelections, SelectionDetail } from "@/lib/participant-selections";

export function ParticipantSelectionCounts({ detail, loading, failed, onOpen, name }: {
  detail: ParticipantSelections;
  loading: boolean;
  failed: boolean;
  onOpen: () => void;
  name: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1" onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}>
      <Button type="button" variant="ghost" size="icon" disabled={loading || failed} onClick={onOpen} title={`Ver selecciones de ${name}`} aria-label={`Ver selecciones de ${name}`} className="h-8 w-8 text-primary">
        <Eye className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={loading || failed} onClick={onOpen} title={`Ver qué cuentas ha seleccionado ${name}`} aria-label={`Ver selecciones enviadas de ${name}`} className={detail.outgoing.length ? "text-primary" : "text-muted-foreground"}>
        <ArrowUpRight /> {loading ? "…" : failed ? "—" : detail.outgoing.length} enviadas
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={loading || failed} onClick={onOpen} title={`Ver qué cuentas han seleccionado a ${name}`} aria-label={`Ver selecciones recibidas de ${name}`} className={detail.incoming.length ? "text-foreground" : "text-muted-foreground"}>
        <ArrowDownLeft /> {loading ? "…" : failed ? "—" : detail.incoming.length} recibidas
      </Button>
      {detail.matches > 0 && <span className="inline-flex items-center gap-1 px-2 text-xs font-medium text-success"><Sparkles className="h-3.5 w-3.5" />{detail.matches} {detail.matches === 1 ? "match" : "matches"}</span>}
    </div>
  );
}

function SelectionColumn({ title, incoming, items }: { title: string; incoming: boolean; items: SelectionDetail[] }) {
  const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
  return (
    <section className="min-w-0">
      <h3 className="mb-3 flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
        <span className="ml-auto text-muted-foreground">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{incoming ? "Todavía no le han seleccionado." : "Todavía no ha realizado selecciones."}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.account_id} className="py-4 first:pt-0">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card">
                  {item.logo_url ? <img src={item.logo_url} alt="" className="h-full w-full object-contain" onError={(event) => { event.currentTarget.hidden = true; }} /> : item.kind === "sponsor" ? <Sparkles className="h-5 w-5 text-muted-foreground" /> : <Building2 className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="break-words text-sm font-semibold">{item.company_name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.kind === "sponsor" ? "Solución" : "Empresa"}</p>
                  <p className="break-words text-xs text-muted-foreground">Vía: {item.responsables.join(", ") || "Responsable"}</p>
                  {item.created_at && <p className="text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" })}</p>}
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${item.mutual ? "text-success" : "text-muted-foreground"}`}>
                    {item.mutual && <Sparkles className="h-3 w-3" />}{item.mutual ? "Match mutuo" : incoming ? "Sin devolver el interés" : "Sin respuesta"}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ParticipantSelectionsPanel({ name, detail, onClose }: { name: string; detail: ParticipantSelections; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-4xl">
        <SheetHeader className="border-b border-border px-5 py-5 pr-12 text-left">
          <SheetTitle className="break-words">{name}</SheetTitle>
          <SheetDescription>Selecciones de la cuenta · {detail.outgoing.length} enviadas · {detail.incoming.length} recibidas · {detail.matches} {detail.matches === 1 ? "match" : "matches"}</SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto px-5 pb-6 md:grid-cols-2 md:gap-8">
          <SelectionColumn title="Ha seleccionado" incoming={false} items={detail.outgoing} />
          <SelectionColumn title="Le han seleccionado" incoming items={detail.incoming} />
        </div>
      </SheetContent>
    </Sheet>
  );
}