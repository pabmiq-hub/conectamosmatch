export type EventHighlight = { event_id: string; sponsor_account_id: string };

export function featuredSolutionIds(rows: EventHighlight[], eventId: string | null): Set<string> {
  return new Set(rows.filter((r) => r.event_id === eventId).map((r) => r.sponsor_account_id));
}

/** Highlights stay first in both directions; names determine order inside each group. */
export function sortSolutions<T extends { id: string; company_name?: string | null }>(
  items: T[], featured: ReadonlySet<string>, direction: "asc" | "desc" = "asc",
): T[] {
  return [...items].sort((a, b) =>
    Number(featured.has(b.id)) - Number(featured.has(a.id)) ||
    (direction === "asc" ? 1 : -1) * (a.company_name ?? "").localeCompare(b.company_name ?? "", "es", { sensitivity: "base" }) ||
    a.id.localeCompare(b.id),
  );
}