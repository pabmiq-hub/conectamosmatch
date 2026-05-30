type Level = "GOLD" | "PREMIUM" | "BASIC" | "STARTUP";

export function LevelBadge({ level }: { level: Level | string | null | undefined }) {
  if (!level) return null;
  const l = String(level).toUpperCase() as Level;
  const cls: Record<Level, string> = {
    GOLD: "bg-gold text-black",
    PREMIUM: "bg-primary text-primary-foreground",
    BASIC: "bg-muted text-foreground",
    STARTUP: "bg-secondary text-secondary-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${cls[l] ?? "bg-muted"}`}
    >
      {l}
    </span>
  );
}
