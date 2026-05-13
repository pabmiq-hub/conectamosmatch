type Level = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE";

export function LevelBadge({ level }: { level: Level | string | null | undefined }) {
  if (!level) return null;
  const l = String(level).toUpperCase() as Level;
  const cls: Record<Level, string> = {
    PLATINUM: "badge-platinum",
    GOLD: "bg-gold text-black",
    SILVER: "bg-silver text-white",
    BRONZE: "bg-bronze text-white",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${cls[l] ?? "bg-muted"}`}
    >
      {l}
    </span>
  );
}
