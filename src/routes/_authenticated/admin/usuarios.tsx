import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { LevelBadge } from "@/components/brand/LevelBadge";
import { Users, Building2, Sparkles, Plus, Search, Trash2, KeyRound, Power } from "lucide-react";
import { toast } from "sonner";
import { NewUserModal } from "@/components/admin/NewUserModal";
import { deleteUserAccount, resetUserPassword, setUserActive } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: AdminUsuarios,
});

function AdminUsuarios() {
  const [tab, setTab] = useState<"all" | "empresa" | "sponsor">("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const resetPwd = useServerFn(resetUserPassword);
  const setActive = useServerFn(setUserActive);
  const delAccount = useServerFn(deleteUserAccount);

  async function load() {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("id, email, full_name, role, is_active, created_at").order("created_at", { ascending: false });
    const { data: empresas } = await supabase.from("empresa_profiles").select("user_id, company_name, sector, logo_url, is_verified");
    const { data: sponsors } = await supabase.from("sponsor_profiles").select("user_id, company_name, sector, logo_url, sponsorship_level, is_verified");
    const empMap = new Map((empresas ?? []).map((e: any) => [e.user_id, e]));
    const spMap = new Map((sponsors ?? []).map((s: any) => [s.user_id, s]));
    const merged = (profiles ?? []).map((p: any) => ({
      ...p,
      company: p.role === "empresa" ? empMap.get(p.id) : p.role === "sponsor" ? spMap.get(p.id) : null,
    }));
    // also append company-only rows (no auth user yet)
    (empresas ?? []).filter((e: any) => !e.user_id || !merged.find((m) => m.id === e.user_id)).forEach((e: any) =>
      merged.push({ id: `emp-${e.user_id ?? e.company_name}`, email: "(sin cuenta)", full_name: e.company_name, role: "empresa", is_active: true, company: e })
    );
    (sponsors ?? []).filter((s: any) => !s.user_id || !merged.find((m) => m.id === s.user_id)).forEach((s: any) =>
      merged.push({ id: `spo-${s.user_id ?? s.company_name}`, email: "(sin cuenta)", full_name: s.company_name, role: "sponsor", is_active: true, company: s })
    );
    setRows(merged);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => (tab === "all" || r.role === tab) && (
    !q || (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()) || (r.email ?? "").toLowerCase().includes(q.toLowerCase()) || (r.company?.company_name ?? "").toLowerCase().includes(q.toLowerCase())
  ));

  return (
    <div className="space-y-6">
      <PageHeader title="Usuarios" subtitle="Gestión de empresas, sponsors y administradores" right={
        <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide" onClick={() => toast.info("Crear usuario: flujo multi-step en próxima iteración")}>
          <Plus className="h-4 w-4" /> Nuevo usuario
        </button>
      } />

      <div className="flex flex-wrap items-center gap-2">
        {([["all","Todos",Users],["empresa","Empresas",Building2],["sponsor","Sponsors",Sparkles]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold text-uppercase-wide ${tab === k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        <div className="ml-auto relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="w-64 rounded-md border border-border bg-card pl-8 pr-3 py-2 text-xs" />
        </div>
      </div>

      {loading ? <EmptyState icon={Users} title="Cargando usuarios..." /> : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Sin resultados" hint="Ajusta los filtros o el buscador" />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] text-uppercase-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Empresa / Usuario</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Rol</th>
                <th className="px-4 py-3 text-left">Sector</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className={i % 2 ? "bg-background" : "bg-card"}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                        {r.company?.logo_url ? <img src={r.company.logo_url} className="max-h-full max-w-full" alt="" /> : <Users className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div>
                        <div className="font-medium text-xs">{r.company?.company_name ?? r.full_name}</div>
                        {r.company?.is_verified && <span className="text-[9px] text-success">✓ Verificada</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">{r.role}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.company?.sector ?? "—"}
                    {r.company?.sponsorship_level && <div className="mt-1"><LevelBadge level={r.company.sponsorship_level} /></div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold text-uppercase-wide ${r.is_active ? "text-success" : "text-muted-foreground"}`}>{r.is_active ? "Activo" : "Inactivo"}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-muted-foreground hover:text-destructive" onClick={() => toast.info("Eliminar disponible próximamente")}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
