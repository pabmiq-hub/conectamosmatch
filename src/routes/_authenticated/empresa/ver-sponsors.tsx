import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PartnerCard } from "@/components/dashboard/PartnerCard";
import { ActionButton, LikeButton, Eye } from "@/components/dashboard/ActionButtons";
import { PartnerDetailModal, type PartnerDetail } from "@/components/dashboard/PartnerDetailModal";
import { PRESET_SPONSOR_CATEGORIES } from "@/lib/sponsor-categories";
import { Search, Filter, X } from "lucide-react";

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
  const [activeCats, setActiveCats] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMe(user.id);
      const { data: ev } = await supabase.from("events").select("id").in("status", ["published","ongoing"]).order("event_date").limit(1).maybeSingle();
      setEventId(ev?.id ?? null);
      const { data: sp } = await supabase.from("sponsor_profiles").select("user_id, company_name, description, logo_url, sector, sponsorship_level, website, location_city, responsables, categories");
      setItems(sp ?? []);
      const myLikes = ev?.id
        ? supabase.from("likes").select("to_user_id").eq("from_user_id", user.id).eq("event_id", ev.id)
        : supabase.from("likes").select("to_user_id").eq("from_user_id", user.id);
      const { data: my } = await myLikes;
      setLikedSet(new Set((my ?? []).map((l: any) => l.to_user_id)));
    })();
  }, []);

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
    return [...base].sort((a, b) => (a.company_name ?? "").localeCompare(b.company_name ?? "", "es", { sensitivity: "base" }));
  }, [items, q, activeCats]);

  const reachedMin = likedSet.size >= MIN_REQUIRED;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-uppercase-wide">Soluciones disponibles</h1>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold text-uppercase-wide ${reachedMin ? "border-success text-success" : "border-border"}`}>
          {likedSet.size} / {MIN_REQUIRED} mínimo {reachedMin && "✓"}
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
      <PartnerDetailModal open={!!selected} onClose={() => setSelected(null)} partner={selected} hideLevel />
    </div>
  );
}
