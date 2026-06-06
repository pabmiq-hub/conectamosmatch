import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Heart, Sparkles, Calendar, ClipboardList, Building2, ArrowRight, ArrowLeft, Pencil, Shield, ArrowRightLeft, UserPlus, ChevronDown, ChevronRight, User } from "lucide-react";
import { getUserActivity, transferAccountAdmin } from "@/lib/admin-users.functions";
import { toast } from "sonner";
import { EditUserModal } from "./EditUserModal";
import { MoveToAccountModal } from "./MoveToAccountModal";
import { InviteResponsableModal } from "./InviteResponsableModal";

export function UserActivityDrawer({ userId, userLabel, onClose, onChanged }: { userId: string; userLabel: string; onClose: () => void; onChanged?: () => void }) {
  const fetchActivity = useServerFn(getUserActivity);
  const makeAdmin = useServerFn(transferAccountAdmin);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"likes" | "matches" | "meetings">("likes");
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchActivity({ data: { userId } }).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [userId]);

  const profile = data?.profile;
  const isAccountUser = profile && (profile.role === "empresa" || profile.role === "sponsor") && profile.account_id;
  const isManager = isAccountUser && profile.account_role !== "owner";

  async function doMakeAdmin() {
    if (!window.confirm(`¿Convertir a ${userLabel} en admin de la cuenta? El admin actual pasará a ser responsable.`)) return;
    try {
      await makeAdmin({ data: { newAdminUserId: userId } });
      toast.success("Admin transferido");
      onChanged?.();
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }


  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-card border-l border-border flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-2 px-5 py-4 border-b border-border">
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-bold text-uppercase-wide truncate">{userLabel}</div>
            <div className="text-[11px] text-muted-foreground">Actividad del usuario {profile?.account_role && <span>· {profile.account_role}</span>}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setEditing(true)} title="Editar datos" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[10px] font-bold text-uppercase-wide hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            {isManager && (
              <button onClick={doMakeAdmin} title="Convertir en admin" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[10px] font-bold text-uppercase-wide hover:bg-muted">
                <Shield className="h-3.5 w-3.5" /> Hacer admin
              </button>
            )}
            {isAccountUser && (
              <button onClick={() => setMoving(true)} title="Mover a otra cuenta" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[10px] font-bold text-uppercase-wide hover:bg-muted">
                <ArrowRightLeft className="h-3.5 w-3.5" /> Mover
              </button>
            )}
            {isAccountUser && (
              <button onClick={() => setInviting(true)} title="Añadir responsable a esta cuenta" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[10px] font-bold text-uppercase-wide hover:bg-muted">
                <UserPlus className="h-3.5 w-3.5" /> + Resp.
              </button>
            )}
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {editing && <EditUserModal userId={userId} onClose={() => setEditing(false)} onSaved={() => { onChanged?.(); }} />}
        {moving && profile && (
          <MoveToAccountModal userId={userId} userLabel={userLabel} currentRole={profile.role} onClose={() => setMoving(false)} onDone={() => { onChanged?.(); onClose(); }} />
        )}
        {inviting && profile?.account_id && (
          <InviteResponsableModal preset={{ accountId: profile.account_id, accountType: profile.role, accountName: userLabel }} onClose={() => setInviting(false)} onCreated={() => { onChanged?.(); }} />
        )}


        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Cargando…</div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No se pudo cargar la actividad.</div>
        ) : (
          <>
            
            <div className="flex border-b border-border px-2">
              {(() => {
                const uniqAccounts = (items: any[], field: string) => {
                  const set = new Set<string>();
                  (items ?? []).forEach((it) => {
                    const raw = String(it[field] ?? "—");
                    const sepIdx = raw.indexOf(" · ");
                    const company = sepIdx >= 0 ? raw.slice(sepIdx + 3).trim() : raw.trim();
                    if (company && company !== "—") set.add(company);
                  });
                  return set.size;
                };
                const uniqMatchAccounts = new Set<string>();
                (data.matches ?? []).forEach((m: any) => {
                  const key = `${m.empresa_account_id ?? m.empresa_user_id}::${m.sponsor_account_id ?? m.sponsor_user_id}`;
                  uniqMatchAccounts.add(key);
                });
                const uniqMeetingAccounts = new Set<string>();
                (data.meetings ?? []).forEach((m: any) => {
                  const key = `${m.empresa_account_id ?? m.empresa_user_id}::${m.sponsor_account_id ?? m.sponsor_user_id}`;
                  uniqMeetingAccounts.add(key);
                });
                const likeOutCount = uniqAccounts(data.likesOut ?? [], "target_name");
                const likeInCount = uniqAccounts(data.likesIn ?? [], "source_name");
                return ([
                  ["likes", `Selecciones (${likeOutCount + likeInCount})`, Heart],
                  ["matches", `Matches (${uniqMatchAccounts.size})`, Sparkles],
                  ["meetings", `1to1 (${uniqMeetingAccounts.size})`, ClipboardList],
                ] as const).map(([k, label, Icon]) => (
                  <button key={k} onClick={() => setTab(k as any)} className={`inline-flex items-center gap-2 px-4 py-3 text-[11px] font-bold text-uppercase-wide border-b-2 transition-colors ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ));
              })()}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {tab === "likes" && (
                <>
                  <Section title="Ha seleccionado" icon={ArrowRight} count={data.likesOut?.length ?? 0}>
                    <GroupedLikes items={data.likesOut ?? []} nameField="target_name" kindField="target_kind" emptyText="Aún no ha seleccionado a nadie" />
                  </Section>
                  <Section title="Le han seleccionado" icon={ArrowLeft} count={data.likesIn?.length ?? 0}>
                    <GroupedLikes items={data.likesIn ?? []} nameField="source_name" kindField="source_kind" emptyText="Nadie le ha seleccionado todavía" />
                  </Section>
                </>
              )}

              {tab === "matches" && (

                <Section title="Matches mutuos" icon={Sparkles} count={data.matches?.length ?? 0}>
                  {(data.matches ?? []).map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium truncate">{m.empresa_name}</span>
                        <Heart className="h-3 w-3 text-primary shrink-0" />
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium truncate">{m.sponsor_name}</span>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold text-uppercase-wide ${m.status === "mutual" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{m.status}</span>
                    </div>
                  ))}
                  {data.matches?.length === 0 && <Empty text="Sin matches todavía" />}
                </Section>
              )}

              {tab === "meetings" && (
                <Section title="Reuniones 1to1" icon={Calendar} count={data.meetings?.length ?? 0}>
                  {(data.meetings ?? []).map((m: any) => (
                    <div key={m.id} className="rounded-lg border border-border bg-background px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-medium truncate">{m.empresa_name} <span className="text-muted-foreground">×</span> {m.sponsor_name}</div>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-uppercase-wide text-muted-foreground">{m.status}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {m.scheduled_time ? new Date(m.scheduled_time).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "Sin hora"} · {m.room ?? "sin sala"} · {m.duration_minutes ?? 15} min
                      </div>
                    </div>
                  ))}
                  {data.meetings?.length === 0 && <Empty text="Sin reuniones agendadas" />}
                </Section>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Section({ title, icon: Icon, count, children }: { title: string; icon: any; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-[11px] font-bold text-uppercase-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title} <span className="text-foreground">({count})</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Row({ kind, name, date }: { kind: "empresa" | "sponsor" | null; name: string; date: string }) {
  const Icon = kind === "sponsor" ? Sparkles : Building2;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium truncate">{name}</span>
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">{new Date(date).toLocaleDateString("es-ES")}</span>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">{text}</div>;
}

function GroupedLikes({ items, nameField, kindField, emptyText }: { items: any[]; nameField: string; kindField: string; emptyText: string }) {
  const groups = useMemo(() => {
    const map = new Map<string, { company: string; kind: "empresa" | "sponsor" | null; companyDate?: string; responsables: { name: string; date: string }[] }>();
    for (const it of items) {
      const raw = String(it[nameField] ?? "—");
      const kind = it[kindField] ?? null;
      const sepIdx = raw.indexOf(" · ");
      const isResp = sepIdx >= 0;
      const company = isResp ? raw.slice(sepIdx + 3).trim() : raw.trim();
      const respName = isResp ? raw.slice(0, sepIdx).trim() : null;
      const key = `${kind ?? "?"}::${company}`;
      if (!map.has(key)) map.set(key, { company, kind, responsables: [] });
      const g = map.get(key)!;
      if (respName) g.responsables.push({ name: respName, date: it.created_at });
      else g.companyDate = it.created_at;
    }
    return Array.from(map.values()).sort((a, b) => a.company.localeCompare(b.company, "es"));
  }, [items, nameField, kindField]);

  if (!items.length) return <Empty text={emptyText} />;
  return <>{groups.map((g, i) => <AccountGroup key={i} group={g} />)}</>;
}

function AccountGroup({ group }: { group: { company: string; kind: "empresa" | "sponsor" | null; companyDate?: string; responsables: { name: string; date: string }[] } }) {
  const [open, setOpen] = useState(true);
  const Icon = group.kind === "sponsor" ? Sparkles : Building2;
  const total = (group.companyDate ? 1 : 0) + group.responsables.length;
  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/40">
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold truncate">{group.company}</span>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{total}</span>
      </button>
      {open && (
        <div className="border-t border-border divide-y divide-border">
          {group.companyDate && (
            <div className="flex items-center justify-between gap-3 px-3 py-1.5 pl-9">
              <span className="text-[11px] text-muted-foreground">Cuenta (titular)</span>
              <span className="text-[10px] text-muted-foreground">{new Date(group.companyDate).toLocaleDateString("es-ES")}</span>
            </div>
          )}
          {group.responsables.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5 pl-9">
              <div className="flex items-center gap-2 min-w-0">
                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] truncate">{r.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{new Date(r.date).toLocaleDateString("es-ES")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
