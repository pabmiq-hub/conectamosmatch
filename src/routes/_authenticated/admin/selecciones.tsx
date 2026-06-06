import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { BookmarkCheck, ChevronDown, ChevronRight, Building2, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { listAccountSelections } from "@/lib/admin-selections.functions";

export const Route = createFileRoute("/_authenticated/admin/selecciones")({
  component: AdminSelecciones,
});

type Side = "empresa" | "sponsor";

function AdminSelecciones() {
  const fn = useServerFn(listAccountSelections);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [side, setSide] = useState<Side>("empresa");
  const [q, setQ] = useState("");
  const [showZero, setShowZero] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fn({ data: undefined as any });
        setEmpresas(r.empresas);
        setSponsors(r.sponsors);
      } catch (e: any) {
        toast.error(e?.message ?? "Error");
      }
    })();
  }, []);

  const accounts = side === "empresa" ? empresas : sponsors;
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return accounts.filter((a) => {
      if (!showZero && a.total === 0) return false;
      if (!term) return true;
      if ((a.company_name ?? "").toLowerCase().includes(term)) return true;
      return (a.targets ?? []).some((t: any) => (t.company_name ?? "").toLowerCase().includes(term));
    });
  }, [accounts, q, showZero]);

  const totalSel = filtered.reduce((s, a) => s + a.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Selecciones"
        subtitle="Cuántas cuentas únicas ha seleccionado cada empresa y cada solución"
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {([
            { id: "empresa" as Side, label: "Empresas", icon: Building2 },
            { id: "sponsor" as Side, label: "Soluciones", icon: Sparkles },
          ]).map((opt) => {
            const Icon = opt.icon;
            const active = side === opt.id;
            return (
              <button key={opt.id} onClick={() => setSide(opt.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-uppercase-wide ${active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cuenta…"
            className="rounded-md border border-border bg-card pl-7 pr-3 py-1.5 text-xs min-w-[220px]"
          />
        </div>
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} />
          Mostrar cuentas con 0 selecciones
        </label>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} cuenta{filtered.length === 1 ? "" : "s"} · {totalSel} selecciones totales
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookmarkCheck} title="Sin cuentas" />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => <AccountCard key={a.account_id} account={a} side={side} />)}
        </div>
      )}
    </div>
  );
}

function AccountCard({ account, side }: { account: any; side: Side }) {
  const [open, setOpen] = useState(false);
  const Icon = side === "empresa" ? Building2 : Sparkles;
  const TargetIcon = side === "empresa" ? Sparkles : Building2;
  const otherLabel = side === "empresa" ? "soluciones" : "empresas";
  const zero = account.total === 0;
  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden ${zero ? "opacity-80" : ""}`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 text-left">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <div className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
          {account.logo_url ? (
            <img src={account.logo_url} alt={account.company_name} className="max-h-full max-w-full object-contain" />
          ) : (
            <Icon className="h-4 w-4 text-primary" />
          )}
        </div>
        <span className="text-sm font-bold truncate">{account.company_name ?? "—"}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-uppercase-wide ${zero ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
          {account.total} {account.total === 1 ? "selección" : "selecciones"}
        </span>
      </button>
      {open && account.total > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {account.targets.map((t: any) => (
            <li key={t.account_id} className="flex items-start gap-3 px-4 py-2.5 text-xs">
              <TargetIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t.company_name}</div>
                {t.responsables.length > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Vía: {t.responsables.join(", ")}
                  </div>
                )}
              </div>
              {t.created_at && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(t.created_at).toLocaleDateString("es-ES")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && account.total === 0 && (
        <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border">
          Esta cuenta aún no ha seleccionado ninguna de las {otherLabel}.
        </div>
      )}
    </div>
  );
}
