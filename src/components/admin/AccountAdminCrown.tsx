import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { transferAccountAdmin, demoteAccountAdmin } from "@/lib/admin-users.functions";

export function AccountAdminCrown({ userId, name, accountName, isAdmin, onChanged }: {
  userId: string; name: string; accountName: string; isAdmin: boolean; onChanged: () => void | Promise<void>;
}) {
  const transfer = useServerFn(transferAccountAdmin);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const demote = useServerFn(demoteAccountAdmin);
  const [otherAdmins, setOtherAdmins] = useState<number | null>(null);
  async function openDialog() {
    setOpen(true);
    if (isAdmin) {
      setOtherAdmins(null);
      try { const r = await demote({ data: { userId, dryRun: true } }); setOtherAdmins(r.otherAdmins); } catch { setOtherAdmins(0); }
    }
  }
  async function confirm() {
    setBusy(true);
    try {
      if (isAdmin) {
        await demote({ data: { userId } });
        setOpen(false);
        await onChanged();
        toast.success(`${name} ya no es administrador de ${accountName}`);
        return;
      }
      await transfer({ data: { newAdminUserId: userId } });
      setOpen(false);
      await onChanged();
      toast.success(`${name} es ahora administrador de ${accountName}`);
    } catch (e: any) { toast.error(e?.message ?? "No se pudo cambiar el administrador"); }
    finally { setBusy(false); }
  }
  const label = isAdmin ? `Quitar administrador a ${name}` : `Hacer administrador a ${name}`;
  return <>
    <Button type="button" variant="ghost" size="icon" title={label} aria-label={label} aria-disabled={busy}
      className={`h-8 w-8 shrink-0 ${isAdmin ? "bg-gold text-foreground hover:bg-gold" : "text-muted-foreground hover:text-foreground"}`}
      onClick={(e) => { e.stopPropagation(); if (!busy) void openDialog(); }}>
      <Crown />
    </Button>
    <AlertDialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()} className="max-w-[calc(100%-2rem)] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{isAdmin ? "¿Quitar administrador?" : "¿Cambiar el administrador?"}</AlertDialogTitle>
          {isAdmin ? <AlertDialogDescription asChild><div className="space-y-2">
            <p><strong>{name}</strong> dejará de ser administrador de <strong>{accountName}</strong> y seguirá como responsable.</p>
            {otherAdmins === null ? <p>Comprobando…</p> : otherAdmins === 0 ? <p className="font-semibold text-destructive">Esta cuenta no tendrá administrador.</p> : null}
          </div></AlertDialogDescription> : <AlertDialogDescription><strong>{name}</strong> será administrador de <strong>{accountName}</strong>. El administrador anterior dejará de serlo y seguirá como responsable. Solo una persona puede ser administradora de esta cuenta.</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <Button disabled={busy || (isAdmin && otherAdmins === null)} onClick={confirm}>{busy && <Loader2 className="animate-spin" />}{busy ? "Guardando…" : isAdmin ? "Sí, quitar administrador" : "Sí, cambiar administrador"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}