import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { UserCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sponsor/mis-invitados")({
  component: MisInvitados,
});

function MisInvitados() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: codes } = await supabase.from("invitation_codes").select("id, code").eq("sponsor_user_id", user.id);
      const ids = (codes ?? []).map((c: any) => c.id);
      if (!ids.length) { setRows([]); return; }
      const { data: regs } = await supabase.from("event_registrations").select("*").in("invitation_code_id", ids).order("registered_at", { ascending: false });
      const cMap = new Map((codes ?? []).map((c: any) => [c.id, c.code]));
      setRows((regs ?? []).map((r: any) => ({ ...r, code: cMap.get(r.invitation_code_id) })));
    })();
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Mis invitados" subtitle="Personas que se han registrado con tus códigos" />
      {rows.length === 0 ? <EmptyState icon={UserCheck} title="Aún no hay invitados" hint="Comparte tus códigos para empezar" /> : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] text-uppercase-wide text-muted-foreground"><tr>
              <th className="px-4 py-3 text-left">Nombre</th><th className="px-4 py-3 text-left">Empresa</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Código</th><th className="px-4 py-3 text-left">Estado</th>
            </tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-xs">{r.attendee_name}</td>
                <td className="px-4 py-3 text-xs">{r.attendee_company}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.attendee_email}</td>
                <td className="px-4 py-3 font-mono text-[11px]">{r.code}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{r.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
