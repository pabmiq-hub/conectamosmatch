import { Eye, MessageSquare, Heart } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  async function onClick() {
    if (liked || disabled) return;
    setBusy(true);
    const { error } = await supabase.from("likes").insert({ from_user_id: fromUserId, to_user_id: toUserId, event_id: eventId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setLiked(true);
    toast.success(`💛 Le has dado like a ${partnerName}`);
  }
  return (
    <ActionButton
      icon={Heart}
      label={liked ? "LIKED" : "MATCH"}
      onClick={onClick}
      variant={liked ? "ghost" : "primary"}
      disabled={busy || disabled}
    />
  );
}

export { Eye, MessageSquare };
