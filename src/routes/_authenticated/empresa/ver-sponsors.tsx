import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PartnerCard } from "@/components/dashboard/PartnerCard";
import { ActionButton, LikeButton, Eye } from "@/components/dashboard/ActionButtons";
import { PartnerDetailModal, type PartnerDetail } from "@/components/dashboard/PartnerDetailModal";

export const Route = createFileRoute("/_authenticated/empresa/ver-sponsors")({
  component: VerSponsors,
});

function VerSponsors() {
  const [me, setMe] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [cap, setCap] = useState<number>(20);
  const [items, setItems] = useState<any[]>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<PartnerDetail | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMe(user.id);
      const { data: ev } = await supabase.from("events").select("id, max_likes_per_user").in("status", ["published","ongoing"]).order("event_date").limit(1).maybeSingle();
      setEventId(ev?.id ?? null);
      setCap(ev?.max_likes_per_user ?? 20);
      const { data: sp } = await supabase.from("sponsor_profiles").select("user_id, company_name, description, logo_url, sector, sponsorship_level, website, location_city, responsables");
      setItems(sp ?? []);
      const myLikes = ev?.id
        ? supabase.from("likes").select("to_user_id").eq("from_user_id", user.id).eq("event_id", ev.id)
        : supabase.from("likes").select("to_user_id").eq("from_user_id", user.id);
      const { data: my } = await myLikes;
      setLikedSet(new Set((my ?? []).map((l: any) => l.to_user_id)));
    })();
  }, []);

  const reachedCap = likedSet.size >= cap;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-uppercase-wide">Sponsors disponibles</h1>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold text-uppercase-wide ${reachedCap ? "border-destructive text-destructive" : "border-border"}`}>
          {likedSet.size} / {cap} seleccionados
        </span>
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
                <ActionButton icon={Eye} label="Ver" onClick={() => setSelected(s)} />
                
                {me && <LikeButton fromUserId={me} toUserId={s.user_id} eventId={eventId} alreadyLiked={likedSet.has(s.user_id)} partnerName={s.company_name} disabled={reachedCap && !likedSet.has(s.user_id)} />}
              </>
            }
          />
        ))}
        {items.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">Aún no hay sponsors registrados.</div>}
      </div>
      <PartnerDetailModal open={!!selected} onClose={() => setSelected(null)} partner={selected} />
    </div>
  );
}
