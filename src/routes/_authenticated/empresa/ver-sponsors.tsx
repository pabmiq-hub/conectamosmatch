import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyEventScope } from "@/hooks/use-my-event";
import { PartnerCard } from "@/components/dashboard/PartnerCard";
import { AccountInterestButton, ActionButton, Eye } from "@/components/dashboard/ActionButtons";
import { PartnerDetailModal, type PartnerDetail } from "@/components/dashboard/PartnerDetailModal";
import { EmpresaLikeModal } from "@/components/sponsor/EmpresaLikeModal";
import { listMyLikedAccountIds } from "@/lib/admin-users.functions";
import { PRESET_SPONSOR_CATEGORIES } from "@/lib/sponsor-categories";
import { Search, Filter, X } from "lucide-react";
import { listFeaturedSolutions } from "@/lib/featured-solutions.functions";
import { featuredSolutionIds } from "@/lib/featured-solutions";
import { getDirectoryOrder } from "@/lib/directory-order.functions";
import { sortDirectory, randomRanks, type DirectoryConfig } from "@/lib/directory-order";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/empresa/ver-sponsors")({
  head: () => ({ meta: [{ title: "Ver soluciones | Conectamos Match" }, { name: "description", content: "Soluciones inscritas y destacadas en tu evento de Conectamos Match." }, { property: "og:title", content: "Ver soluciones | Conectamos Match" }, { property: "og:description", content: "Encuentra las soluciones de tu evento." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: VerSponsors,
});


function VerSponsors() {
  const getLikedAccounts = useServerFn(listMyLikedAccountIds);
  const getFeatured = useServerFn(listFeaturedSolutions);
  const getOrder = useServerFn(getDirectoryOrder);
  const [order, setOrder] = useState<DirectoryConfig>({ mode: "alphabetical", counts: {} });
  const [ranks, setRanks] = useState<Record<string, number>>({});
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [MIN_REQUIRED, setMinRequired] = useState(12);
  const [items, setItems] = useState<any[]>([]);
  const [likedAccountIds, setLikedAccountIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<PartnerDetail | null>(null);
  const [likeTarget, setLikeTarget] = useState<{ userId: string; name: string } | null>(null);
  const [q, setQ] = useState("");
  const [activeCats, setActiveCats] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    const scope = await fetchMyEventScope();
    const ev = scope.event;
    setEventId(ev?.id ?? null);
    if (ev) setOrder(await getOrder({ data: { eventId: ev.id, kind: "sponsor" } }));
    setFeaturedIds(featuredSolutionIds(ev ? await getFeatured({ data: { eventId: ev.id } }) : [], ev?.id ?? null));
    setMinRequired((ev as any)?.empresa_min_likes ?? 12);
    // Only the soluciones registered for this same event
    const ids = scope.sponsorAccountIds;
    setRanks((previous) => Object.keys(previous).length ? previous : randomRanks(ids));
    const { data: sp } = ids.length
      ? await supabase.from("sponsor_profiles").select("id, user_id, company_name, description, logo_url, sector, sponsorship_level, website, location_city, responsables, categories").in("id", ids)
      : { data: [] as any[] };
    setItems(((sp ?? []) as any[]).map((a: any) => ({ ...a, user_id: scope.accountOwners?.[a.id] ?? a.user_id })));
    const liked = await getLikedAccounts({ data: { eventId: ev?.id ?? null } });
    setLikedAccountIds(new Set(liked.accountIds));
  }
  useEffect(() => { void load().catch(() => toast.error("No se pudieron cargar las soluciones. Recarga la página para reintentar.")); }, []);

  // Categories present in the actual sponsor list (preset + custom)
  const availableCats = useMemo(() => {
    const set = new Set<string>();
    items.forEach((s) => (s.categories ?? []).forEach((c: string) => c && set.add(c)));
    const ordered = [
      ...PRESET_SPONSOR_CATEGORIES.filter((c) => set.has(c)),
      ...Array.from(set).filter((c) => !PRESET_SPONSOR_CATEGORIES.includes(c as any)).sort((a, b) => a.localeCompare(b, "es")),
    ];
    return ordered;
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let base = items;
    if (term) base = base.filter((s) => String(s.company_name ?? "").toLowerCase().includes(term));
    if (activeCats.length) base = base.filter((s) => Array.isArray(s.categories) && activeCats.every((c) => s.categories.includes(c)));
    return sortDirectory(base, order, featuredIds, ranks);
  }, [items, q, activeCats, order, featuredIds, ranks]);


  const reachedMin = likedAccountIds.size >= MIN_REQUIRED;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-uppercase-wide">Soluciones disponibles</h1>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold text-uppercase-wide ${reachedMin ? "border-success text-success" : "border-border"}`}>
          {likedAccountIds.size} / {MIN_REQUIRED} mínimo {reachedMin && "✓"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar solución por nombre…" className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm" />
        </div>
        <button onClick={() => setShowFilters((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-bold text-uppercase-wide ${activeCats.length ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}>
          <Filter className="h-3.5 w-3.5" /> Retos {activeCats.length > 0 && `(${activeCats.length})`}
        </button>
        {activeCats.length > 0 && (
          <button onClick={() => setActiveCats([])} className="text-[11px] text-muted-foreground underline">Limpiar</button>
        )}
      </div>


      {showFilters && availableCats.length > 0 && (
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[10px] text-uppercase-wide font-bold text-muted-foreground mb-2">Filtrar por retos que solucionan</div>
          <div className="flex flex-wrap gap-1.5">
            {availableCats.map((c) => {
              const on = activeCats.includes(c);
              return (
                <button key={c} onClick={() => setActiveCats(on ? activeCats.filter((x) => x !== c) : [...activeCats, c])}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                  {c} {on && <X className="inline h-3 w-3 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((s) => {
          const liked = s.id ? likedAccountIds.has(s.id) : false;
          return (
            <PartnerCard
              key={s.id}
              name={s.company_name}
              description={s.description}
              logoUrl={s.logo_url}
              sector={s.sector}
              liked={liked}
              recommended={featuredIds.has(s.id)}
              actions={
                <>
                  <ActionButton icon={Eye} label="Ver" onClick={() => setSelected(s)} />
                  {me && s.user_id && (
                    <AccountInterestButton
                      disabled={!eventId}
                      targetUserId={s.user_id}
                      eventId={eventId}
                      partnerName={s.company_name}
                      liked={liked}
                      onLike={() => setLikeTarget({ userId: s.user_id, name: s.company_name })}
                      onUnliked={load}
                    />
                  )}
                </>
              }
            />
          );
        })}
        {filtered.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">{items.length === 0 ? "Todavía no hay soluciones inscritas en tu evento." : "No hay soluciones que coincidan con tu búsqueda."}</div>}
      </div>
      <PartnerDetailModal open={!!selected} onClose={() => setSelected(null)} partner={selected} hideLevel />
      {likeTarget && (
        <EmpresaLikeModal
          empresaUserId={likeTarget.userId}
          empresaName={likeTarget.name}
          eventId={eventId}
          accountLabel="solución"
          onClose={() => setLikeTarget(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
