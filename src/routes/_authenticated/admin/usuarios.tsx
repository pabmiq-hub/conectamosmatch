import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { LevelBadge } from "@/components/brand/LevelBadge";
import { Users, Building2, Sparkles, Plus, Search, Trash2, KeyRound, Power, Upload, UserPlus, Inbox, Check, X, CornerDownRight, Shield, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { NewUserModal } from "@/components/admin/NewUserModal";
import { ImportUsersModal } from "@/components/admin/ImportUsersModal";
import { InviteResponsableModal } from "@/components/admin/InviteResponsableModal";
import { ApproveRequestModal } from "@/components/admin/ApproveRequestModal";
import { deleteUserAccount, resetUserPassword, setUserActive } from "@/lib/admin-users.functions";
import { listAllRequests, rejectRequest, type ResponsableRequest } from "@/lib/responsable-requests.functions";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: AdminUsuarios,
});

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "empresa" | "sponsor" | "super_admin";
  account_id: string | null;
  account_role: string | null;
  is_active: boolean;
  company?: any;
};

function AdminUsuarios() {
  const [tab, setTab] = useState<"all" | "empresa" | "sponsor" | "admin">("all");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"company_asc" | "company_desc" | "owner_asc" | "owner_desc">("company_asc");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [invitePreset, setInvitePreset] = useState<{ accountId: string; accountType: "empresa" | "sponsor"; accountName: string } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [requests, setRequests] = useState<ResponsableRequest[]>([]);
  const [approving, setApproving] = useState<ResponsableRequest | null>(null);
  const resetPwd = useServerFn(resetUserPassword);
  const setActive = useServerFn(setUserActive);
  const delAccount = useServerFn(deleteUserAccount);
  const fetchRequests = useServerFn(listAllRequests);
  const reject = useServerFn(rejectRequest);

  async function load() {
    setLoading(true);
    const [{ data: profs }, { data: empresas }, { data: sponsors }, reqs] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, role, account_id, account_role, is_active, created_at").order("created_at", { ascending: false }),
      supabase.from("empresa_profiles").select("id, user_id, company_name, sector, logo_url, is_verified"),
      supabase.from("sponsor_profiles").select("id, user_id, company_name, sector, logo_url, sponsorship_level, is_verified"),
      fetchRequests().catch(() => [] as ResponsableRequest[]),
    ]);
    const empByAccount = new Map((empresas ?? []).map((e: any) => [e.id, e]));
    const spoByAccount = new Map((sponsors ?? []).map((s: any) => [s.id, s]));
    const merged: Profile[] = (profs ?? []).map((p: any) => ({
      ...p,
      company: p.role === "empresa" ? empByAccount.get(p.account_id) : p.role === "sponsor" ? spoByAccount.get(p.account_id) : null,
    }));
    setProfiles(merged);
    setRequests(reqs);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const matchQ = (p: Profile) => !q || (p.full_name ?? "").toLowerCase().includes(q.toLowerCase()) || (p.email ?? "").toLowerCase().includes(q.toLowerCase()) || (p.company?.company_name ?? "").toLowerCase().includes(q.toLowerCase());

    // Group by account_id; owner first, managers next
    const byAccount = new Map<string, { owner: Profile | null; managers: Profile[] }>();
    const admins: Profile[] = [];
    const orphans: Profile[] = [];

    for (const p of profiles) {
      if (p.role === "super_admin") { admins.push(p); continue; }
      if (!p.account_id) { orphans.push(p); continue; }
      const g = byAccount.get(p.account_id) ?? { owner: null, managers: [] };
      if (p.account_role === "owner") g.owner = p;
      else g.managers.push(p);
      byAccount.set(p.account_id, g);
    }

    // Filter
    const groups = Array.from(byAccount.values()).filter((g) => {
      const all = [g.owner, ...g.managers].filter(Boolean) as Profile[];
      if (!all.some(matchQ)) return false;
      if (tab === "empresa") return (g.owner?.role ?? g.managers[0]?.role) === "empresa";
      if (tab === "sponsor") return (g.owner?.role ?? g.managers[0]?.role) === "sponsor";
      if (tab === "admin") return false;
      return true;
    });

    // Sort
    const cmp = (a: { owner: Profile | null; managers: Profile[] }, b: { owner: Profile | null; managers: Profile[] }) => {
      const ah = a.owner ?? a.managers[0];
      const bh = b.owner ?? b.managers[0];
      const companyA = (ah?.company?.company_name ?? ah?.full_name ?? "").toLowerCase();
      const companyB = (bh?.company?.company_name ?? bh?.full_name ?? "").toLowerCase();
      const ownerA = (a.owner?.full_name ?? a.owner?.email ?? "").toLowerCase();
      const ownerB = (b.owner?.full_name ?? b.owner?.email ?? "").toLowerCase();
      switch (sortBy) {
        case "company_desc": return companyB.localeCompare(companyA);
        case "owner_asc": return ownerA.localeCompare(ownerB);
        case "owner_desc": return ownerB.localeCompare(ownerA);
        default: return companyA.localeCompare(companyB);
      }
    };
    groups.sort(cmp);

    return {
      groups,
      admins: tab === "all" || tab === "admin" ? admins.filter(matchQ) : [],
      orphans: tab === "all" ? orphans.filter(matchQ) : [],
    };
  }, [profiles, tab, q, sortBy]);

  const pendingRequests = requests.filter((r) => r.status === "pending");

  async function onReset(id: string) {
    const np = window.prompt("Nueva contraseña (mín. 8 caracteres):");
    if (!np || np.length < 8) return;
    try { await resetPwd({ data: { userId: id, password: np } }); toast.success("Contraseña actualizada"); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  async function onToggle(p: Profile) {
    try { await setActive({ data: { userId: p.id, isActive: !p.is_active } }); toast.success(p.is_active ? "Desactivado" : "Activado"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }
  async function onDelete(p: Profile) {
    const name = p.company?.company_name ?? p.full_name ?? p.email;
    const extra = p.account_role === "owner" ? " Esto eliminará también la cuenta y todos sus responsables." : "";
    if (!window.confirm(`¿Eliminar a ${name}?${extra} Esta acción no se puede deshacer.`)) return;
    try { await delAccount({ data: { userId: p.id } }); toast.success("Eliminado"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Error"); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Usuarios" subtitle="Gestión de cuentas (empresas/sponsors), sus responsables y administradores" right={
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-xs font-bold text-uppercase-wide" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4" /> Importar Excel
          </button>
          <button className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-xs font-bold text-uppercase-wide" onClick={() => setShowInvite(true)}>
            <UserPlus className="h-4 w-4" /> Invitar responsable
          </button>
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground text-uppercase-wide" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" /> Nueva cuenta
          </button>
        </div>
      } />

      {showModal && <NewUserModal onClose={() => setShowModal(false)} onCreated={load} />}
      {showImport && <ImportUsersModal onClose={() => setShowImport(false)} onDone={load} />}
      {showInvite && <InviteResponsableModal onClose={() => setShowInvite(false)} onCreated={load} />}
      {invitePreset && <InviteResponsableModal preset={invitePreset} onClose={() => setInvitePreset(null)} onCreated={load} />}
      {approving && <ApproveRequestModal req={approving} onClose={() => setApproving(null)} onDone={load} />}

      {/* Pending requests panel */}
      {pendingRequests.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
          <div className="border-b border-primary/20 bg-primary/10 px-4 py-2.5 text-[11px] font-bold text-uppercase-wide text-primary flex items-center gap-2">
            <Inbox className="h-4 w-4" /> Solicitudes de responsable pendientes ({pendingRequests.length})
          </div>
          <ul className="divide-y divide-border">
            {pendingRequests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-bold truncate">{r.full_name} <span className="text-muted-foreground font-normal">· {r.email}</span></div>
                  <div className="text-[11px] text-muted-foreground">
                    Cuenta: <span className="font-bold">{r.account_name}</span> ({r.account_type}) · Solicitado por {r.requester_name ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setApproving(r)} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground text-uppercase-wide">
                    <Check className="h-3.5 w-3.5" /> Aprobar
                  </button>
                  <button onClick={async () => {
                    const reason = window.prompt("Motivo de rechazo (opcional):") ?? "";
                    try { await reject({ data: { id: r.id, reason } }); toast.success("Solicitud rechazada"); load(); }
                    catch (e: any) { toast.error(e?.message ?? "Error"); }
                  }} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[11px] font-bold text-uppercase-wide">
                    <X className="h-3.5 w-3.5" /> Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {([["all","Todos",Users],["empresa","Empresas",Building2],["sponsor","Sponsors",Sparkles],["admin","Admins",Shield]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold text-uppercase-wide ${tab === k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="rounded-md border border-border bg-card px-2 py-2 text-xs font-bold text-uppercase-wide">
            <option value="company_asc">Empresa A→Z</option>
            <option value="company_desc">Empresa Z→A</option>
            <option value="owner_asc">Owner A→Z</option>
            <option value="owner_desc">Owner Z→A</option>
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empresa u owner..." className="w-64 rounded-md border border-border bg-card pl-8 pr-3 py-2 text-xs" />
          </div>
        </div>
      </div>

      {loading ? <EmptyState icon={Users} title="Cargando usuarios..." /> : grouped.groups.length === 0 && grouped.admins.length === 0 && grouped.orphans.length === 0 ? (
        <EmptyState icon={Users} title="Sin resultados" hint="Ajusta los filtros o el buscador" />
      ) : (
        <div className="space-y-4">
          {grouped.groups.map((g) => {
            const head = g.owner ?? g.managers[0];
            const accountName = head?.company?.company_name ?? head?.full_name ?? "(sin nombre)";
            const role = head?.role;
            const key = head?.account_id ?? head?.id ?? "";
            const isOpen = expanded.has(key);
            const canExpand = g.managers.length > 0;
            const toggle = () => {
              if (!canExpand) return;
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
              });
            };
            return (
              <div key={key} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Account header (owner) */}
                <AccountHeader owner={g.owner} role={role} accountName={accountName} managersCount={g.managers.length} isOpen={isOpen} onToggle={toggle} canExpand={canExpand} onReset={onReset} onToggleActive={onToggle} onDelete={onDelete} onAddResponsable={head?.account_id && (role === "empresa" || role === "sponsor") ? () => setInvitePreset({ accountId: head.account_id!, accountType: role as "empresa" | "sponsor", accountName }) : undefined} />
                {/* Managers */}
                {isOpen && g.managers.length > 0 && (
                  <ul className="divide-y divide-border border-t border-border bg-muted/10">
                    {g.managers.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 pl-10 text-sm">
                        <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-xs truncate">{m.full_name ?? m.email}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {m.email} · <span className="font-bold">Responsable de {accountName}</span>
                          </div>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-uppercase-wide text-muted-foreground">Responsable</span>
                        <span className={`text-[10px] font-bold text-uppercase-wide ${m.is_active ? "text-success" : "text-muted-foreground"}`}>{m.is_active ? "Activo" : "Inactivo"}</span>
                        <RowActions p={m} onReset={onReset} onToggle={onToggle} onDelete={onDelete} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {grouped.admins.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-bold text-uppercase-wide text-muted-foreground flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Super administradores</div>
              <ul className="divide-y divide-border">
                {grouped.admins.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center"><Shield className="h-4 w-4 text-primary" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-xs truncate">{p.full_name ?? p.email}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{p.email}</div>
                    </div>
                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">Super Admin</span>
                    <RowActions p={p} onReset={onReset} onToggle={onToggle} onDelete={onDelete} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {grouped.orphans.length > 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-bold text-uppercase-wide text-muted-foreground">Sin cuenta asociada</div>
              <ul className="divide-y divide-border">
                {grouped.orphans.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-xs truncate">{p.full_name ?? p.email}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{p.email} · rol {p.role}</div>
                    </div>
                    <RowActions p={p} onReset={onReset} onToggle={onToggle} onDelete={onDelete} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AccountHeader({ owner, role, accountName, managersCount, isOpen, onToggle, canExpand, onReset, onToggleActive, onDelete, onAddResponsable }: { owner: Profile | null; role: string | undefined; accountName: string; managersCount: number; isOpen: boolean; onToggle: () => void; canExpand: boolean; onReset: (id: string) => void; onToggleActive: (p: Profile) => void; onDelete: (p: Profile) => void; onAddResponsable?: () => void }) {
  const Icon = role === "sponsor" ? Sparkles : Building2;
  const company = owner?.company;
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 bg-muted/20 ${canExpand ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""}`}
      onClick={canExpand ? onToggle : undefined}
      role={canExpand ? "button" : undefined}
      aria-expanded={canExpand ? isOpen : undefined}
    >
      <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-90" : ""} ${canExpand ? "" : "opacity-30"}`} />
      <div className="h-10 w-10 rounded-md bg-card border border-border overflow-hidden flex items-center justify-center shrink-0">
        {company?.logo_url ? <img src={company.logo_url} className="max-h-full max-w-full" alt="" /> : <Icon className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display font-bold text-sm truncate">{accountName}</span>
          <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[9px] font-bold text-uppercase-wide">{role}</span>
          {company?.is_verified && <span className="text-[9px] text-success">✓ Verificada</span>}
          {company?.sponsorship_level && <LevelBadge level={company.sponsorship_level} />}
          {managersCount > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-uppercase-wide text-muted-foreground">
              {managersCount} {managersCount === 1 ? "responsable" : "responsables"}
            </span>
          )}
        </div>
        {owner ? (
          <div className="text-[11px] text-muted-foreground truncate">
            Owner: <span className="font-bold text-foreground">{owner.full_name ?? owner.email}</span> · {owner.email}
            {company?.sector ? ` · ${company.sector}` : ""}
          </div>
        ) : (
          <div className="text-[11px] text-warning">Sin owner asignado</div>
        )}
      </div>
      <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold text-uppercase-wide">Owner</span>
      {owner && (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
          <span className={`text-[10px] font-bold text-uppercase-wide ${owner.is_active ? "text-success" : "text-muted-foreground"}`}>{owner.is_active ? "Activo" : "Inactivo"}</span>
          <RowActions p={owner} onReset={onReset} onToggle={onToggleActive} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

function RowActions({ p, onReset, onToggle, onDelete }: { p: Profile; onReset: (id: string) => void; onToggle: (p: Profile) => void; onDelete: (p: Profile) => void }) {
  return (
    <div className="inline-flex items-center gap-1 shrink-0">
      <button title="Resetear contraseña" className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => onReset(p.id)}><KeyRound className="h-4 w-4" /></button>
      <button title={p.is_active ? "Desactivar" : "Activar"} className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => onToggle(p)}><Power className="h-4 w-4" /></button>
      <button title="Eliminar" className="p-1.5 text-muted-foreground hover:text-destructive" onClick={() => onDelete(p)}><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
