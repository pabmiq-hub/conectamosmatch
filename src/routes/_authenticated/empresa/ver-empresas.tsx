import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PartnerCard } from "@/components/dashboard/PartnerCard";
import { ActionButton, Eye } from "@/components/dashboard/ActionButtons";
import { PartnerDetailModal, type PartnerDetail } from "@/components/dashboard/PartnerDetailModal";

export const Route = createFileRoute("/_authenticated/empresa/ver-empresas")({
  component: VerEmpresas,
});

function VerEmpresas() {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<PartnerDetail | null>(null);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("empresa_profiles").select("user_id, company_name, description, logo_url, sector, company_size, website, location_city, responsables");
      setItems((data ?? []).filter((e: any) => e.user_id !== user?.id));
    })();
  }, []);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-uppercase-wide">Empresas participantes</h1>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-uppercase-wide">{items.length} empresas</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((e) => (
          <PartnerCard key={e.user_id} name={e.company_name} description={e.description} logoUrl={e.logo_url} sector={e.sector} size={e.company_size}
            actions={<ActionButton icon={Eye} label="Ver" onClick={() => setSelected(e)} />} />
        ))}
      </div>
      <PartnerDetailModal open={!!selected} onClose={() => setSelected(null)} partner={selected} />
    </div>
  );
}
