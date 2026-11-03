import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { dismissEntryPopup, fetchEntryPopup, type EntryPopup } from "@/lib/reto";
import { PartyPopper, Target } from "lucide-react";

/**
 * Pop-up ligero al entrar en la app: nueva misión desbloqueada o hito colectivo.
 * La BD decide qué mostrar y guarda el «visto»; aquí no hay temporizadores.
 */
export function RetoEntryPopup({ eventId, role }: { eventId: string; role: "empresa" | "sponsor" }) {
  const [popup, setPopup] = useState<EntryPopup | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    fetchEntryPopup(eventId).then((p) => { if (alive) setPopup(p); });
    return () => { alive = false; };
  }, [eventId]);

  if (!popup) return null;

  const close = (go: boolean) => {
    const p = popup;
    setPopup(null);
    dismissEntryPopup(eventId, p.kind).catch(() => {});
    if (go) navigate({ to: role === "sponsor" ? "/sponsor/reto-misiones" : "/empresa/reto-misiones" });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) close(false); }}>
      <DialogContent className="max-w-sm">
        {popup.kind === "mission" ? (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Target className="h-6 w-6" />
              </div>
              <div className="text-center text-[10px] font-bold text-uppercase-wide text-primary">Nueva misión desbloqueada</div>
              <DialogTitle className="text-center font-display text-2xl">{popup.title}</DialogTitle>
              {popup.description && <DialogDescription className="text-center">{popup.description}</DialogDescription>}
            </DialogHeader>
            <div className="text-center font-display text-3xl font-bold text-primary">
              +{popup.bonus_points}
              {popup.max_awards > 1 && <span className="ml-1 text-sm text-muted-foreground">×{popup.max_awards}</span>}
            </div>
            <DialogFooter className="gap-2 sm:justify-center">
              <Button variant="outline" onClick={() => close(false)}>Ahora no</Button>
              <Button onClick={() => close(true)}>¡Voy a por ello!</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                <PartyPopper className="h-6 w-6" />
              </div>
              <div className="text-center text-[10px] font-bold text-uppercase-wide text-primary">Hito colectivo</div>
              <DialogTitle className="text-center font-display text-2xl">
                ¡{popup.value.toLocaleString("es-ES")} conexiones!
              </DialogTitle>
              <DialogDescription className="text-center">
                Entre todos ya sumamos {popup.total.toLocaleString("es-ES")} conexiones recíprocas. ¡A por las 2.700!
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button onClick={() => close(false)}>¡Seguimos!</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
