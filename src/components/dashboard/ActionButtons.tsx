import { Eye, MessageSquare, Heart } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  icon: typeof Eye; label: string; onClick?: () => void; variant?: "ghost" | "primary"; disabled?: boolean;
}) {
  const cls = variant === "primary"
    ? "bg-primary text-primary-foreground hover:bg-primary/90"
    : "border border-border text-foreground hover:bg-muted";
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-bold text-uppercase-wide ${cls} disabled:opacity-40 disabled:cursor-not-allowed`}>
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

export function LikeButton({
  fromUserId, toUserId, eventId, alreadyLiked, partnerName, disabled,
}: {
  fromUserId: string; toUserId: string; eventId: string | null; alreadyLiked?: boolean; partnerName: string; disabled?: boolean;
}) {
  const [liked, setLiked] = useState(!!alreadyLiked);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function doLike() {
    setBusy(true);
    const { error } = await supabase.from("likes").insert({ from_user_id: fromUserId, to_user_id: toUserId, event_id: eventId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setLiked(true);
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
        label={liked ? "LIKED" : "MATCH"}
        onClick={onClick}
        variant={liked ? "ghost" : "primary"}
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

export { Eye, MessageSquare };
