import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PartnerCard } from "@/components/dashboard/PartnerCard";
import { ActionButton, LikeButton, Eye } from "@/components/dashboard/ActionButtons";
import { PageHeader } from "@/components/dashboard/EmptyState";
import { PartnerDetailModal, type PartnerDetail } from "@/components/dashboard/PartnerDetailModal";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sponsor/ver-empresas")({
  component: VerEmpresasSponsor,
});

function VerEmpresasSponsor() {
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
      const { data } = await supabase.from("empresa_profiles").select("user_id, company_name, description, logo_url, sector, company_size, website, location_city, responsables");
      setItems(data ?? []);
      const myLikes = ev?.id
        ? supabase.from("likes").select("to_user_id").eq("from_user_id", user.id).eq("event_id", ev.id)
        : supabase.from("likes").select("to_user_id").eq("from_user_id", user.id);
      const { data: my } = await myLikes;
      setLikedSet(new Set((my ?? []).map((l: any) => l.to_user_id)));
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((e) => `${e.company_name ?? ""} ${e.sector ?? ""} ${e.location_city ?? ""}`.toLowerCase().includes(term));
  }, [items, q]);

  return (
    <div className="space-y-6">
      <PageHeader title="Empresas participantes" right={
        <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-uppercase-wide">
          {likedSet.size} seleccionadas
        </span>
      } />
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empresa por nombre, sector o ciudad…" className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((e) => (
          <PartnerCard key={e.user_id ?? e.company_name} name={e.company_name} description={e.description} logoUrl={e.logo_url} sector={e.sector} size={e.company_size}
            actions={<>
              <ActionButton icon={Eye} label="Ver" onClick={() => setSelected(e)} />
              {me && e.user_id && <LikeButton fromUserId={me} toUserId={e.user_id} eventId={eventId} alreadyLiked={likedSet.has(e.user_id)} partnerName={e.company_name} />}
            </>} />
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">No hay empresas que coincidan con tu búsqueda.</div>}
      </div>
      <PartnerDetailModal open={!!selected} onClose={() => setSelected(null)} partner={selected} />
    </div>
  );
}
