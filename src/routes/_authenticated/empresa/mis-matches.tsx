import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { PartnerCard } from "@/components/dashboard/PartnerCard";
import { ActionButton, Eye } from "@/components/dashboard/ActionButtons";
import { PartnerDetailModal, type PartnerDetail } from "@/components/dashboard/PartnerDetailModal";
import { listMyAccountMatches } from "@/lib/account-matches.functions";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresa/mis-matches")({
  component: MisMatchesEmpresa,
});

function MisMatchesEmpresa() {
  const getMatches = useServerFn(listMyAccountMatches);
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<PartnerDetail | null>(null);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { partnerAccountIds } = await getMatches({ data: undefined as any });
      if (!partnerAccountIds.length) { setItems([]); return; }
      const { data: sps } = await supabase
        .from("sponsor_profiles")
        .select("user_id, company_name, description, logo_url, sector, sponsorship_level, website, location_city, responsables")
        .in("id", partnerAccountIds);
      setItems(sps ?? []);
    })();
  }, []);

  const rank = (lvl?: string | null) => {
    const u = String(lvl ?? "").toUpperCase();
    if (u === "GOLD") return 0;
    if (u === "PREMIUM") return 1;
    if (u === "BASIC") return 2;
    return 3;
  };
  const sorted = [...items].sort((a, b) => {
    const dr = rank(a.sponsorship_level) - rank(b.sponsorship_level);
    if (dr !== 0) return dr;
    return (a.company_name ?? "").localeCompare(b.company_name ?? "", "es", { sensitivity: "base" });
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Mis matches" subtitle="Soluciones con las que tu cuenta ha hecho match mutuo" />
      {sorted.length === 0 ? <EmptyState icon={Heart} title="Aún no tenéis matches" hint="Da like a soluciones desde 'Ver Soluciones' para empezar" /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((s) => (
            <PartnerCard key={s.user_id} name={s.company_name} description={s.description} logoUrl={s.logo_url} sector={s.sector}
              actions={<ActionButton icon={Eye} label="Ver" onClick={() => setSelected(s)} />} />
          ))}
        </div>
      )}
      <PartnerDetailModal open={!!selected} onClose={() => setSelected(null)} partner={selected} hideLevel />
    </div>
  );
}
