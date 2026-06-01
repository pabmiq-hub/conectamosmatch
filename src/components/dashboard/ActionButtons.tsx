import { Eye, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { unlikeEmpresaAccount } from "@/lib/admin-users.functions";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ActionButton({ icon: Icon, label, onClick, variant = "ghost", disabled }: {
  icon: typeof Eye; label: string; onClick?: () => void; variant?: "ghost" | "primary" | "primary-outline"; disabled?: boolean;
}) {
  const cls =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : variant === "primary-outline"
      ? "border border-primary text-primary bg-transparent hover:bg-primary/10"
      : "border border-border text-foreground hover:bg-muted";
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-bold text-uppercase-wide ${cls} disabled:opacity-40 disabled:cursor-not-allowed`}>
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

export function LikeButton({
  fromUserId, toUserId, eventId, alreadyLiked, partnerName, disabled, onLikedChange,
}: {
  fromUserId: string; toUserId: string; eventId: string | null; alreadyLiked?: boolean; partnerName: string; disabled?: boolean; onLikedChange?: (liked: boolean) => void;
}) {
  const [liked, setLiked] = useState(!!alreadyLiked);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setLiked(!!alreadyLiked);
  }, [alreadyLiked]);

  async function doLike() {
    setBusy(true);
    const { error } = await supabase.from("likes").insert({ from_user_id: fromUserId, to_user_id: toUserId, event_id: eventId });
    setBusy(false);
    if (error) {
      if ((error as any).code === "23505" || /duplicate key/i.test(error.message)) {
        setLiked(true);
        onLikedChange?.(true);
        toast.success(`Ya tenías like a ${partnerName}`);
        return;
      }
      toast.error(error.message); return;
    }
    setLiked(true);
    onLikedChange?.(true);
    toast.success(`💛 Le has dado like a ${partnerName}`);
  }

  async function doUnlike() {
    setBusy(true);
    let q = supabase.from("likes").delete().eq("from_user_id", fromUserId).eq("to_user_id", toUserId);
    q = eventId ? q.eq("event_id", eventId) : q.is("event_id", null);
    const { error } = await q;
    setBusy(false);
    setConfirmOpen(false);
    if (error) { toast.error(error.message); return; }
    setLiked(false);
    onLikedChange?.(false);
    toast.success(`Has retirado tu like a ${partnerName}`);
  }

  function onClick() {
    if (disabled) return;
    if (liked) { setConfirmOpen(true); return; }
    doLike();
  }

  return (
    <>
      <ActionButton
        icon={Heart}
        label={liked ? "LIKED" : "ME INTERESA"}
        onClick={onClick}
        variant={liked ? "primary" : "primary-outline"}
        disabled={busy || disabled}
      />
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Retirar tu like a {partnerName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Si retiras el like, <strong>{partnerName} no recibirá ningún aviso</strong> y, por
              tanto, <strong>no habrá match</strong> entre vosotros aunque luego os volváis a
              dar like. El match mutuo desaparecerá del recuento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doUnlike} disabled={busy}>
              Sí, retirar like
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AccountInterestButton({
  targetUserId, eventId, partnerName, liked, disabled, onLike, onUnliked,
}: {
  targetUserId: string; eventId: string | null; partnerName: string; liked: boolean; disabled?: boolean; onLike: () => void; onUnliked?: () => void;
}) {
  const unlike = useServerFn(unlikeEmpresaAccount);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function doUnlike() {
    setBusy(true);
    try {
      await unlike({ data: { empresaUserId: targetUserId, eventId } });
      toast.success(`Has retirado tu like a ${partnerName}`);
      onUnliked?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al retirar el like");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <ActionButton
        icon={Heart}
        label={liked ? "LIKED" : "ME INTERESA"}
        variant={liked ? "primary" : "primary-outline"}
        disabled={busy || disabled}
        onClick={() => (liked ? setConfirmOpen(true) : onLike())}
      />
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Retirar tu like a {partnerName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se retirará tu interés por esta cuenta y se desharán los matches y reuniones asociados a esta interacción.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doUnlike} disabled={busy}>Sí, retirar like</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { Eye };
