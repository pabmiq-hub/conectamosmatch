import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { PartnerCard } from "@/components/dashboard/PartnerCard";
import { ActionButton, Eye, MessageSquare } from "@/components/dashboard/ActionButtons";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sponsor/mis-matches")({
  component: MisMatchesSponsor,
});

function MisMatchesSponsor() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: matches } = await supabase.from("matches").select("*").eq("sponsor_user_id", user.id).eq("status","mutual");
      const ids = (matches ?? []).map((m: any) => m.empresa_user_id).filter(Boolean);
      if (!ids.length) { setItems([]); return; }
      const { data } = await supabase.from("empresa_profiles").select("user_id, company_name, description, logo_url, sector, company_size").in("user_id", ids);
      setItems(data ?? []);
    })();
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Mis matches" subtitle="Empresas con las que has hecho match mutuo" />
      {items.length === 0 ? <EmptyState icon={Heart} title="Aún no tienes matches" hint="Da like a empresas desde 'Ver Empresas' para empezar" /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((e) => (
            <PartnerCard key={e.user_id} name={e.company_name} description={e.description} logoUrl={e.logo_url} sector={e.sector} size={e.company_size}
              actions={<><ActionButton icon={Eye} label="Ver" /><ActionButton icon={MessageSquare} label="Msg" variant="primary" /></>} />
          ))}
        </div>
      )}
    </div>
  );
}
