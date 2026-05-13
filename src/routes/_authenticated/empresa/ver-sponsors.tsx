import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PartnerCard } from "@/components/dashboard/PartnerCard";
import { ActionButton, LikeButton, Eye, MessageSquare } from "@/components/dashboard/ActionButtons";

export const Route = createFileRoute("/_authenticated/empresa/ver-sponsors")({
  component: VerSponsors,
});

function VerSponsors() {
  const [me, setMe] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMe(user.id);
      const { data: ev } = await supabase.from("events").select("id").in("status", ["published","ongoing"]).order("event_date").limit(1).maybeSingle();
      setEventId(ev?.id ?? null);
      const { data: sp } = await supabase.from("sponsor_profiles").select("user_id, company_name, description, logo_url, sector, sponsorship_level");
      setItems(sp ?? []);
      const { data: my } = await supabase.from("likes").select("to_user_id").eq("from_user_id", user.id);
      setLikedSet(new Set((my ?? []).map((l: any) => l.to_user_id)));
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-uppercase-wide">Sponsors disponibles</h1>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-uppercase-wide">{likedSet.size} / 20 seleccionados</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((s) => (
          <PartnerCard
            key={s.user_id}
            name={s.company_name}
            description={s.description}
            logoUrl={s.logo_url}
            sector={s.sector}
            level={s.sponsorship_level}
            actions={
              <>
                <ActionButton icon={Eye} label="Ver" />
                <ActionButton icon={MessageSquare} label="Msg" />
                {me && <LikeButton fromUserId={me} toUserId={s.user_id} eventId={eventId} alreadyLiked={likedSet.has(s.user_id)} partnerName={s.company_name} />}
              </>
            }
          />
        ))}
        {items.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">Aún no hay sponsors registrados.</div>}
      </div>
    </div>
  );
}
