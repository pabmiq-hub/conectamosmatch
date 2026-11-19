import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyEventScope } from "@/hooks/use-my-event";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresa/tablon")({
  component: TablonEmpresa,
});

function TablonEmpresa() {
  const [posts, setPosts] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      // Global notices plus the ones of my current event only
      const ev = (await fetchMyEventScope()).event;
      let q = supabase.from("bulletin_posts").select("*").order("created_at", { ascending: false });
      q = ev ? q.or(`scope.eq.global,event_id.eq.${ev.id}`) : q.eq("scope", "global");
      const { data } = await q;
      setPosts(data ?? []);
    })();
  }, []);
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Tablón de anuncios" subtitle="Avisos del organizador del evento" />
      {posts.length === 0 ? <EmptyState icon={Megaphone} title="Sin anuncios" /> : (
        <div className="space-y-3">{posts.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm">{p.content}</div>
            <div className="mt-2 text-[10px] text-uppercase-wide text-muted-foreground">{new Date(p.created_at).toLocaleString("es-ES")}</div>
          </div>
        ))}</div>
      )}
    </div>
  );
}
