export const DIRECTORY_MODES = [
  { value: "alphabetical", label: "Alfabético (A–Z)" },
  { value: "most_interest", label: "Más interés recibido" },
  { value: "least_interest", label: "Menos interés recibido" },
  { value: "random", label: "Aleatorio" },
] as const;
export type DirectoryMode = typeof DIRECTORY_MODES[number]["value"];
export type DirectoryKind = "empresa" | "sponsor";
export type DirectoryConfig = { mode: DirectoryMode; counts: Record<string, number> };

/** One incoming selection per source account, regardless of how many teammates clicked. */
export function receivedInterest(
  likes: { from_user_id: string | null; to_user_id: string | null }[],
  profiles: { id: string; account_id: string | null }[],
  allowed: ReadonlySet<string>,
): Record<string, number> {
  const owners = new Map(profiles.map((p) => [p.id, p.account_id]));
  const sources = new Map<string, Set<string>>();
  for (const like of likes) {
    const from = owners.get(like.from_user_id ?? "");
    const to = owners.get(like.to_user_id ?? "");
    if (!from || !to || from === to || !allowed.has(from) || !allowed.has(to)) continue;
    const incoming = sources.get(to) ?? new Set<string>();
    incoming.add(from);
    sources.set(to, incoming);
  }
  return Object.fromEntries([...allowed].map((id) => [id, sources.get(id)?.size ?? 0]));
}

/** Shuffle once per visit; filter and like updates keep that visit's ranks stable. */
export function randomRanks(ids: string[], random: () => number = Math.random): Record<string, number> {
  const shuffled = [...ids].sort();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = shuffled[i]; const b = shuffled[j];
    if (a !== undefined && b !== undefined) { shuffled[i] = b; shuffled[j] = a; }
  }
  return Object.fromEntries(shuffled.map((id, i) => [id, i]));
}

export function sortDirectory<T extends { id: string; company_name?: string | null }>(
  items: T[], config: DirectoryConfig, featured: ReadonlySet<string> = new Set(), ranks: Record<string, number> = {},
): T[] {
  return [...items].sort((a, b) => {
    const priority = Number(featured.has(b.id)) - Number(featured.has(a.id));
    if (priority) return priority;
    const difference = config.mode === "random" ? (ranks[a.id] ?? 0) - (ranks[b.id] ?? 0)
      : config.mode === "most_interest" ? (config.counts[b.id] ?? 0) - (config.counts[a.id] ?? 0)
      : config.mode === "least_interest" ? (config.counts[a.id] ?? 0) - (config.counts[b.id] ?? 0) : 0;
    return difference || (a.company_name ?? "").localeCompare(b.company_name ?? "", "es", { sensitivity: "base" }) || a.id.localeCompare(b.id);
  });
}