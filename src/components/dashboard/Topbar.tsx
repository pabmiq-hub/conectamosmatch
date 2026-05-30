import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, LogOut, LayoutDashboard, User, Search, Users, Heart, Calendar, Megaphone, ClipboardList, Settings, Building2, UsersRound, Shield } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { NotificationsBell } from "@/components/dashboard/NotificationsBell";
import { signOut, type AppRole } from "@/lib/auth";

const navByRole: Record<AppRole, { to: string; label: string; icon: typeof LayoutDashboard }[]> = {
  super_admin: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/usuarios", label: "Usuarios", icon: Users },
    { to: "/admin/eventos", label: "Eventos", icon: Calendar },
    { to: "/admin/matches", label: "Matches", icon: Heart },
    { to: "/admin/reuniones", label: "Reuniones 1to1", icon: ClipboardList },
    { to: "/admin/tablon", label: "Tablón", icon: Megaphone },
  ],
  empresa: [
    { to: "/empresa/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/empresa/mi-ficha", label: "Mi Ficha", icon: User },
    { to: "/empresa/ver-sponsors", label: "Ver Soluciones", icon: Search },
    { to: "/empresa/ver-empresas", label: "Ver Empresas", icon: Building2 },
    { to: "/empresa/mis-matches", label: "Mis Matches", icon: Heart },
    { to: "/empresa/reuniones-1to1", label: "Reuniones 1to1", icon: ClipboardList },
    { to: "/empresa/equipo", label: "Mi Equipo", icon: UsersRound },
    { to: "/empresa/tablon", label: "Tablón", icon: Megaphone },
    { to: "/empresa/agenda", label: "Agenda", icon: Calendar },
  ],
  sponsor: [
    { to: "/sponsor/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/sponsor/mi-ficha", label: "Mi Ficha", icon: User },
    { to: "/sponsor/ver-empresas", label: "Ver Empresas", icon: Search },
    { to: "/sponsor/mis-matches", label: "Mis Matches", icon: Heart },
    { to: "/sponsor/reuniones-1to1", label: "Reuniones 1to1", icon: ClipboardList },
    { to: "/sponsor/equipo", label: "Mi Equipo", icon: UsersRound },
    { to: "/sponsor/tablon", label: "Tablón", icon: Megaphone },
    { to: "/sponsor/agenda", label: "Agenda", icon: Calendar },
  ],
};

export function Topbar({ title, userName, role, companyName }: { title?: string; userName?: string | null; role?: AppRole; companyName?: string }) {
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
                <div className="h-10 w-10 rounded-md bg-card border border-border flex items-center justify-center shrink-0">
                  {role === "super_admin" ? <Shield className="h-5 w-5 text-primary" /> : <Settings className="h-5 w-5 text-primary" />}
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
