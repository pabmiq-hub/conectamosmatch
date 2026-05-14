import { Link, useRouterState } from "@tanstack/react-router";
import { signOut, type AppRole } from "@/lib/auth";
import { LayoutDashboard, User, Search, Users, Heart, Calendar, MessageSquare, Megaphone, ClipboardList, LogOut, Settings, Building2 } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const navByRole: Record<AppRole, NavItem[]> = {
  super_admin: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/usuarios", label: "Usuarios", icon: Users },
    { to: "/admin/eventos", label: "Eventos", icon: Calendar },
    { to: "/admin/matches", label: "Matches", icon: Heart },
    { to: "/admin/reuniones", label: "Reuniones 1to1", icon: ClipboardList },
    { to: "/admin/codigos", label: "Códigos", icon: Ticket },
    { to: "/admin/tablon", label: "Tablón", icon: Megaphone },
  ],
  empresa: [
    { to: "/empresa/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/empresa/mi-ficha", label: "Mi Ficha", icon: User },
    { to: "/empresa/ver-sponsors", label: "Ver Sponsors", icon: Search },
    { to: "/empresa/ver-empresas", label: "Ver Empresas", icon: Building2 },
    { to: "/empresa/mis-matches", label: "Mis Matches", icon: Heart },
    { to: "/empresa/reuniones-1to1", label: "Reuniones 1to1", icon: ClipboardList },
    { to: "/empresa/mensajes", label: "Mensajes", icon: MessageSquare },
    { to: "/empresa/tablon", label: "Tablón", icon: Megaphone },
    { to: "/empresa/agenda", label: "Agenda", icon: Calendar },
  ],
  sponsor: [
    { to: "/sponsor/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/sponsor/mi-ficha", label: "Mi Ficha", icon: User },
    { to: "/sponsor/ver-empresas", label: "Ver Empresas", icon: Search },
    { to: "/sponsor/mis-matches", label: "Mis Matches", icon: Heart },
    { to: "/sponsor/reuniones-1to1", label: "Reuniones 1to1", icon: ClipboardList },
    { to: "/sponsor/mis-codigos", label: "Mis Códigos", icon: Ticket },
    { to: "/sponsor/mis-invitados", label: "Mis Invitados", icon: UserCheck },
    { to: "/sponsor/mensajes", label: "Mensajes", icon: MessageSquare },
    { to: "/sponsor/tablon", label: "Tablón", icon: Megaphone },
    { to: "/sponsor/agenda", label: "Agenda", icon: Calendar },
  ],
};

export function Sidebar({ role, companyName }: { role: AppRole; companyName: string }) {
  const items = navByRole[role];
  const path = useRouterState({ select: (r) => r.location.pathname });
  const roleBadge = role === "super_admin" ? "ADMIN" : role === "sponsor" ? "SPONSOR" : "EMPRESA";

  return (
    <aside className="hidden md:flex w-[200px] shrink-0 flex-col bg-sidebar border-r border-sidebar-border min-h-screen">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center h-12 w-12 rounded-md bg-card border border-border mx-auto">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div className="mt-3 text-center">
          <div className="font-display text-xs font-bold text-uppercase-wide truncate">{companyName}</div>
          <span className="mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground text-uppercase-wide">{roleBadge}</span>
        </div>
      </div>
      <nav className="flex-1 py-2">
        {items.map((it) => {
          const active = path === it.to || (it.to !== "/admin" && path.startsWith(it.to));
          const Icon = it.icon;
          return (
            <Link key={it.to} to={it.to}
              className={`relative flex items-center gap-3 px-4 py-2.5 text-xs text-uppercase-wide font-medium transition-colors ${
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
          className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs text-uppercase-wide font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
