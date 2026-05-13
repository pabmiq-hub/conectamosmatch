import { Bell } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export function Topbar({ title, userName }: { title?: string; userName?: string | null }) {
  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-4">
        <div className="md:hidden"><Logo /></div>
        {title && <h1 className="hidden md:block font-display text-sm font-bold text-uppercase-wide text-muted-foreground">{title}</h1>}
      </div>
      <div className="flex items-center gap-3">
        <button className="relative rounded-md p-2 hover:bg-muted">
          <Bell className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            {(userName ?? "U").slice(0, 1).toUpperCase()}
          </div>
          <span className="hidden md:block text-xs text-uppercase-wide">{userName}</span>
        </div>
      </div>
    </header>
  );
}
