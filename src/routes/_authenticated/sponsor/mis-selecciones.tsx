import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { PartnerCard } from "@/components/dashboard/PartnerCard";
import { AccountInterestButton, ActionButton, Eye } from "@/components/dashboard/ActionButtons";
import { PartnerDetailModal, type PartnerDetail } from "@/components/dashboard/PartnerDetailModal";
import { listMyLikedAccountIds } from "@/lib/admin-users.functions";
import { Heart, Search } from "lucide-react";
import { SortToggle, sortByName, type SortDir } from "@/components/dashboard/SortToggle";

export const Route = createFileRoute("/_authenticated/sponsor/mis-selecciones")({
  component: MisSeleccionesSponsor,
});

function MisSeleccionesSponsor() {
  const getLikedAccounts = useServerFn(listMyLikedAccountIds);
  const [me, setMe] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [matchedSet, setMatchedSet] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<PartnerDetail | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMe(user.id);
      const { data: ev } = await supabase.from("events").select("id").in("status", ["published","ongoing"]).order("event_date").limit(1).maybeSingle();
      setEventId(ev?.id ?? null);

      const likedAccounts = await getLikedAccounts({ data: { eventId: ev?.id ?? null } });
      const ids = likedAccounts.accountIds;
      if (!ids.length) { setItems([]); return; }

      const { data: emp } = await supabase
        .from("empresa_profiles")
        .select("user_id, company_name, description, logo_url, sector, company_size, website, location_city, responsables")
        .in("id", ids);
      setItems(emp ?? []);

      const { data: matches } = await supabase
        .from("matches")
        .select("empresa_user_id")
        .eq("sponsor_user_id", user.id)
        .eq("status", "mutual");
      setMatchedSet(new Set((matches ?? []).map((m: any) => m.empresa_user_id)));
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((e) => `${e.company_name ?? ""} ${e.sector ?? ""} ${e.location_city ?? ""}`.toLowerCase().includes(term));
  }, [items, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis selecciones"
        subtitle="Empresas a las que has dado like. Puedes retirar tu selección en cualquier momento, incluso si hay match."
        right={
          <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-uppercase-wide">
            {items.length} seleccionadas
          </span>
        }
      />

      {items.length === 0 ? (
        <EmptyState icon={Heart} title="Aún no has seleccionado ninguna empresa" hint="Ve a 'Ver Empresas' para empezar a dar like" />
      ) : (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en tus selecciones…" className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((e) => (
              <PartnerCard
                key={e.user_id}
                name={e.company_name}
                description={e.description}
                logoUrl={e.logo_url}
                sector={e.sector}
                size={e.company_size}
                liked
                actions={
                  <>
                    <ActionButton icon={Eye} label={matchedSet.has(e.user_id) ? "MATCH ✓" : "Ver"} onClick={() => setSelected(e)} />
                    {me && <AccountInterestButton targetUserId={e.user_id} eventId={eventId} partnerName={e.company_name} liked onLike={() => {}} onUnliked={() => setItems((prev) => prev.filter((item) => item.user_id !== e.user_id))} />}
                  </>
                }
              />
            ))}
            {filtered.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">Ninguna selección coincide con la búsqueda.</div>}
          </div>
        </>
      )}
      <PartnerDetailModal open={!!selected} onClose={() => setSelected(null)} partner={selected} />
    </div>
  );
}
