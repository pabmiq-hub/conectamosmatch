import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DIRECTORY_MODES, type DirectoryKind, type DirectoryMode } from "@/lib/directory-order";
import { getDirectoryOrder, setDirectoryOrder } from "@/lib/directory-order.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function DirectoryOrderControls({ eventId }: { eventId: string }) {
  const getOrder = useServerFn(getDirectoryOrder);
  const saveOrder = useServerFn(setDirectoryOrder);
  const [modes, setModes] = useState<Record<DirectoryKind, DirectoryMode>>({ empresa: "alphabetical", sponsor: "alphabetical" });
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  async function load() {
    setBusy(true); setFailed(false);
    try {
      const [empresa, sponsor] = await Promise.all([getOrder({ data: { eventId, kind: "empresa" } }), getOrder({ data: { eventId, kind: "sponsor" } })]);
      setModes({ empresa: empresa.mode, sponsor: sponsor.mode });
    } catch { setFailed(true); } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [eventId]);
  async function change(kind: DirectoryKind, mode: DirectoryMode) {
    setBusy(true);
    try {
      await saveOrder({ data: { eventId, kind, mode } });
      setModes((previous) => ({ ...previous, [kind]: mode }));
      toast.success("Orden guardado para este evento");
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar el orden"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-y border-border py-4">
    <h2 className="text-sm font-semibold">Orden de los listados de participantes</h2>
    {failed ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">No se pudo cargar el orden.<Button size="sm" variant="outline" onClick={() => void load()}>Reintentar</Button></div> :
      <div className="grid gap-4 sm:grid-cols-2">
        {(["empresa", "sponsor"] as const).map((kind) => <div key={kind} className="min-w-0 space-y-2">
          <label id={`order-label-${kind}`} className="text-xs font-semibold text-muted-foreground">{kind === "empresa" ? "Empresas · Ver empresas" : "Soluciones · Ver soluciones"}</label>
          <Select disabled={busy} value={modes[kind]} onValueChange={(value) => void change(kind, value as DirectoryMode)}>
            <SelectTrigger aria-labelledby={`order-label-${kind}`} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{DIRECTORY_MODES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>)}
      </div>}
  </section>;
}