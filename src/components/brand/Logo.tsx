import logoUrl from "@/assets/conectamos-logo.png";

export function Logo({ className = "", showTagline = true }: { className?: string; showTagline?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img src={logoUrl} alt="Conectamos" className="h-8 w-auto md:h-9 object-contain" />
      <div className="leading-none border-l border-border pl-3 hidden sm:block">
        <div className="font-display text-sm font-bold tracking-tight uppercase text-foreground">Match</div>
        {showTagline && <div className="text-[10px] text-muted-foreground tracking-wider">by conectamos.club</div>}
      </div>
    </div>
  );
}
