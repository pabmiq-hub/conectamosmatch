import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, LogOut, Settings, Shield } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { NotificationsBell } from "@/components/dashboard/NotificationsBell";
import { signOut, type AppRole } from "@/lib/auth";
import { navByRole } from "@/components/dashboard/Sidebar";

export function Topbar({ title, userName, role, companyName, logoUrl }: { title?: string; userName?: string | null; role?: AppRole; companyName?: string; logoUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (r) => r.location.pathname });
  const items = role ? navByRole[role] : [];
  const roleBadge = role === "super_admin" ? "ADMIN" : role === "sponsor" ? "SPONSOR" : "EMPRESA";

  return (
    <>
      <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          {role && (
            <button onClick={() => setOpen(true)} className="md:hidden p-2 -ml-2 text-foreground" aria-label="Abrir menú">
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="md:hidden"><Logo /></div>
          {title && <h1 className="hidden md:block font-display text-sm font-bold text-uppercase-wide text-muted-foreground">{title}</h1>}
        </div>
        <div className="flex items-center gap-3">
          <NotificationsBell />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              {(userName ?? "U").slice(0, 1).toUpperCase()}
            </div>
            <span className="hidden md:block text-xs text-uppercase-wide">{userName}</span>
          </div>
        </div>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-sidebar-border flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-10 w-10 rounded-md bg-card border border-border flex items-center justify-center shrink-0 overflow-hidden">
                  {logoUrl ? (
                    <img src={logoUrl} alt={companyName ?? "logo"} className="max-h-full max-w-full object-contain" />
                  ) : role === "super_admin" ? (
                    <Shield className="h-5 w-5 text-primary" />
                  ) : (
                    <Settings className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-display text-xs font-bold text-uppercase-wide truncate">{companyName ?? userName ?? "Usuario"}</div>
                  <span className="mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground text-uppercase-wide">{roleBadge}</span>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Cerrar menú"><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex-1 py-2">
              {items.map((it) => {
                const active = path === it.to || (it.to !== "/admin" && path.startsWith(it.to));
                const Icon = it.icon;
                return (
                  <Link key={it.to} to={it.to} onClick={() => setOpen(false)}
                    className={`relative flex items-center gap-3 px-4 py-3 text-sm text-uppercase-wide font-medium transition-colors ${
                      active ? "text-primary bg-sidebar-accent" : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}>
                    {active && <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-sidebar-border">
              <button onClick={() => signOut()}
                className="w-full flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-uppercase-wide font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
