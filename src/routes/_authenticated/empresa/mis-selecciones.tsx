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

export const Route = createFileRoute("/_authenticated/empresa/mis-selecciones")({
  component: MisSeleccionesEmpresa,
});

const MIN_REQUIRED = 12;

function MisSeleccionesEmpresa() {
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

      const { data: sp } = await supabase
        .from("sponsor_profiles")
        .select("user_id, company_name, description, logo_url, sector, sponsorship_level, website, location_city, responsables")
        .in("id", ids);
      setItems(sp ?? []);

      const { data: matches } = await supabase
        .from("matches")
        .select("sponsor_user_id")
        .eq("empresa_user_id", user.id)
        .eq("status", "mutual");
      setMatchedSet(new Set((matches ?? []).map((m: any) => m.sponsor_user_id)));
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

  const reachedMin = items.length >= MIN_REQUIRED;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis selecciones"
        subtitle="Soluciones a las que has dado like. Puedes retirar tu selección en cualquier momento, incluso si hay match."
        right={
          <span className={`rounded-full border px-3 py-1 text-xs font-bold text-uppercase-wide ${reachedMin ? "border-success text-success" : "border-border"}`}>
            {items.length} / {MIN_REQUIRED} mínimo {reachedMin && "✓"}
          </span>
        }
      />

      {items.length === 0 ? (
        <EmptyState icon={Heart} title="Aún no has seleccionado ninguna solución" hint="Ve a 'Ver Soluciones' para empezar a dar like" />
      ) : (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en tus selecciones…" className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((s) => (
              <PartnerCard
                key={s.user_id}
                name={s.company_name}
                description={s.description}
                logoUrl={s.logo_url}
                sector={s.sector}
                liked

                actions={
                  <>
                    <ActionButton icon={Eye} label={matchedSet.has(s.user_id) ? "MATCH ✓" : "Ver"} onClick={() => setSelected(s)} />
                    {me && <AccountInterestButton targetUserId={s.user_id} eventId={eventId} partnerName={s.company_name} liked onLike={() => {}} onUnliked={() => setItems((prev) => prev.filter((item) => item.user_id !== s.user_id))} />}
                  </>
                }
              />
            ))}
            {filtered.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">Ninguna selección coincide con la búsqueda.</div>}
          </div>
        </>
      )}
      <PartnerDetailModal open={!!selected} onClose={() => setSelected(null)} partner={selected} hideLevel />
    </div>
  );
}
