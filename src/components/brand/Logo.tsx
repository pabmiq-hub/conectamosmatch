export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden>
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
        <circle cx="9" cy="12" r="2.5" fill="currentColor" />
        <circle cx="23" cy="12" r="2.5" fill="currentColor" />
        <circle cx="16" cy="22" r="2.5" fill="currentColor" />
        <path d="M9 12 L23 12 L16 22 Z" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      </svg>
      <div className="leading-none">
        <div className="font-display text-sm font-bold tracking-tight uppercase">Conectamos Match</div>
        <div className="text-[10px] text-muted-foreground tracking-wider">by conectamos.club</div>
      </div>
    </div>
  );
}
