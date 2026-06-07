import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { PartnerCard } from "@/components/dashboard/PartnerCard";
import { AccountInterestButton, ActionButton, Eye } from "@/components/dashboard/ActionButtons";
import { PartnerDetailModal, type PartnerDetail } from "@/components/dashboard/PartnerDetailModal";
import { EmpresaLikeModal } from "@/components/sponsor/EmpresaLikeModal";
import { listMyLikedAccountIds } from "@/lib/admin-users.functions";
import { Inbox, Search } from "lucide-react";
import { SortToggle, sortByName, type SortDir } from "@/components/dashboard/SortToggle";
import { toast } from "sonner";
import { listEmpresasWhoLikedMe } from "@/lib/sponsor-incoming.functions";

export const Route = createFileRoute("/_authenticated/sponsor/me-han-seleccionado")({
  component: EmpresasQueMeHanSeleccionado,
});

function EmpresasQueMeHanSeleccionado() {
  const fn = useServerFn(listEmpresasWhoLikedMe);
  const getLikedAccounts = useServerFn(listMyLikedAccountIds);
  const [items, setItems] = useState<any[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [likedAccountIds, setLikedAccountIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<PartnerDetail | null>(null);
  const [likeTarget, setLikeTarget] = useState<{ userId: string; name: string } | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMe(user.id);
      const { data: ev } = await supabase.from("events").select("id").in("status", ["published","ongoing"]).order("event_date").limit(1).maybeSingle();
      setEventId(ev?.id ?? null);
      const r = await fn({ data: undefined as any });
      setItems(r.items);
      const liked = await getLikedAccounts({ data: { eventId: ev?.id ?? null } });
      setLikedAccountIds(new Set(liked.accountIds));
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((e) =>
      `${e.company_name ?? ""} ${e.sector ?? ""} ${e.location_city ?? ""}`.toLowerCase().includes(term),
    );
  }, [items, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas que me han seleccionado"
        subtitle="Empresas cuyos responsables han mostrado interés en tu solución o en alguno de tus responsables."
        right={
          <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-uppercase-wide">
            {items.length} empresa{items.length === 1 ? "" : "s"}
          </span>
        }
      />

      {items.length === 0 ? (
        <EmptyState icon={Inbox} title="Aún no te ha seleccionado ninguna empresa" hint="Te avisaremos cuando una empresa muestre interés." />
      ) : (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar empresa…"
              className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((e) => {
              const liked = e.account_id ? likedAccountIds.has(e.account_id) : e.matched;
              return (
                <div key={e.account_id} className="flex flex-col gap-2">
                  <PartnerCard
                    name={e.company_name}
                    description={e.description}
                    logoUrl={e.logo_url}
                    sector={e.sector}
                    size={e.company_size}
                    liked={liked}
                    actions={
                      <>
                        <ActionButton icon={Eye} label="Ver" onClick={() => setSelected(e)} />
                        {me && e.user_id && (
                          <AccountInterestButton
                            targetUserId={e.user_id}
                            eventId={eventId}
                            partnerName={e.company_name}
                            liked={liked}
                            onLike={() => setLikeTarget({ userId: e.user_id, name: e.company_name })}
                            onUnliked={load}
                          />
                        )}
                      </>
                    }
                  />
                  <div className="space-y-1 rounded-md border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
                    {e.via_responsables?.length > 0 && (
                      <div><span className="font-bold text-foreground/80">Vía:</span> {e.via_responsables.join(", ")}</div>
                    )}
                    {e.liked_responsables?.length > 0 && (
                      <div><span className="font-bold text-foreground/80">Interés en:</span> {e.liked_responsables.join(", ")}</div>
                    )}
                    {e.created_at && (
                      <div>{new Date(e.created_at).toLocaleDateString("es-ES")}</div>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-sm text-muted-foreground py-12">
                Ninguna empresa coincide con la búsqueda.
              </div>
            )}
          </div>
        </>
      )}
      <PartnerDetailModal open={!!selected} onClose={() => setSelected(null)} partner={selected} />
      {likeTarget && (
        <EmpresaLikeModal
          empresaUserId={likeTarget.userId}
          empresaName={likeTarget.name}
          eventId={eventId}
          onClose={() => setLikeTarget(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
