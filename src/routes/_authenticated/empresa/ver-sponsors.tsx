import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PartnerCard } from "@/components/dashboard/PartnerCard";
import { ActionButton, LikeButton, Eye } from "@/components/dashboard/ActionButtons";
import { PartnerDetailModal, type PartnerDetail } from "@/components/dashboard/PartnerDetailModal";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresa/ver-sponsors")({
  component: VerSponsors,
});

const MIN_REQUIRED = 12;

function VerSponsors() {
  const [me, setMe] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<PartnerDetail | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMe(user.id);
      const { data: ev } = await supabase.from("events").select("id").in("status", ["published","ongoing"]).order("event_date").limit(1).maybeSingle();
      setEventId(ev?.id ?? null);
      const { data: sp } = await supabase.from("sponsor_profiles").select("user_id, company_name, description, logo_url, sector, sponsorship_level, website, location_city, responsables");
      setItems(sp ?? []);
      const myLikes = ev?.id
        ? supabase.from("likes").select("to_user_id").eq("from_user_id", user.id).eq("event_id", ev.id)
        : supabase.from("likes").select("to_user_id").eq("from_user_id", user.id);
      const { data: my } = await myLikes;
      setLikedSet(new Set((my ?? []).map((l: any) => l.to_user_id)));
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = !term ? items : items.filter((s) => `${s.company_name ?? ""} ${s.sector ?? ""} ${s.location_city ?? ""}`.toLowerCase().includes(term));
    const rank = (lvl?: string | null) => {
      const u = String(lvl ?? "").toUpperCase();
      if (u === "GOLD") return 0;
      if (u === "PREMIUM") return 1;
      if (u === "BASIC") return 2;
      return 3;
    };
    return [...base].sort((a, b) => {
      const dr = rank(a.sponsorship_level) - rank(b.sponsorship_level);
      if (dr !== 0) return dr;
      return (a.company_name ?? "").localeCompare(b.company_name ?? "", "es", { sensitivity: "base" });
    });
  }, [items, q]);

  const reachedMin = likedSet.size >= MIN_REQUIRED;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-uppercase-wide">Soluciones disponibles</h1>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold text-uppercase-wide ${reachedMin ? "border-success text-success" : "border-border"}`}>
          {likedSet.size} / {MIN_REQUIRED} mínimo {reachedMin && "✓"}
        </span>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar solución por nombre, sector o ciudad…" className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((s) => (
          <PartnerCard
            key={s.user_id}
            name={s.company_name}
            description={s.description}
            logoUrl={s.logo_url}
            sector={s.sector}
            actions={
              <>
                <ActionButton icon={Eye} label="Ver" onClick={() => setSelected(s)} />
                {me && <LikeButton fromUserId={me} toUserId={s.user_id} eventId={eventId} alreadyLiked={likedSet.has(s.user_id)} partnerName={s.company_name} />}
              </>
            }
          />
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">No hay soluciones que coincidan con tu búsqueda.</div>}
      </div>
      <PartnerDetailModal open={!!selected} onClose={() => setSelected(null)} partner={selected} hideLevel recommended={String((selected as any)?.sponsorship_level ?? "").toUpperCase() === "GOLD"} />
    </div>
  );
}
