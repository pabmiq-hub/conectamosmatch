import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { Heart, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/matches")({
  component: AdminMatches,
});

function AdminMatches() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: matches } = await supabase.from("matches").select("*").order("matched_at", { ascending: false });
      const empIds = Array.from(new Set((matches ?? []).map((m: any) => m.empresa_user_id).filter(Boolean)));
      const spIds = Array.from(new Set((matches ?? []).map((m: any) => m.sponsor_user_id).filter(Boolean)));
      const [{ data: emps }, { data: sps }] = await Promise.all([
        supabase.from("empresa_profiles").select("user_id, company_name, logo_url").in("user_id", empIds.length ? empIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("sponsor_profiles").select("user_id, company_name, logo_url, sponsorship_level").in("user_id", spIds.length ? spIds : ["00000000-0000-0000-0000-000000000000"]),
      ]);
      const eMap = new Map((emps ?? []).map((e: any) => [e.user_id, e]));
      const sMap = new Map((sps ?? []).map((s: any) => [s.user_id, s]));
      setRows((matches ?? []).map((m: any) => ({ ...m, empresa: eMap.get(m.empresa_user_id), sponsor: sMap.get(m.sponsor_user_id) })));
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Matches" subtitle="Conexiones mutuas generadas en la plataforma" />
      {rows.length === 0 ? <EmptyState icon={Heart} title="Aún no hay matches" hint="Cuando empresa y sponsor se den like mutuamente aparecerán aquí" /> : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] text-uppercase-wide text-muted-foreground">
              <tr><th className="px-4 py-3 text-left">Empresa</th><th /><th className="px-4 py-3 text-left">Sponsor</th><th className="px-4 py-3 text-left">Estado</th><th className="px-4 py-3 text-left">Fecha</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-xs">{r.empresa?.company_name ?? "—"}</td>
                  <td className="px-2 py-3"><ArrowRight className="h-4 w-4 text-primary" /></td>
                  <td className="px-4 py-3 font-medium text-xs">{r.sponsor?.company_name ?? "—"}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{r.status}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.matched_at && new Date(r.matched_at).toLocaleDateString("es-ES")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
