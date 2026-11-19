import { sortByName, type SortDir } from "@/components/dashboard/SortToggle";

/** Filtro de tipo de participante en el panel de Participantes del evento. */
export type RoleFilter = "all" | "empresa" | "sponsor";

/** Campo alfabético por el que se ordena la lista. */
export type SortField = "company" | "name";

export type RegistrationRow = {
  role_at_event?: string | null;
  attendee_company?: string | null;
  attendee_name?: string | null;
};

/** Etiquetas visibles del rol: «sponsor» se muestra siempre como «Solución». */
export const ROLE_LABEL: Record<string, string> = { sponsor: "Solución", empresa: "Empresa" };

export function roleLabel(r: RegistrationRow): string {
  return ROLE_LABEL[r.role_at_event ?? ""] ?? r.role_at_event ?? "—";
}

/** Cuántos participantes hay de cada tipo, para las etiquetas del filtro. */
export function roleCounts(rows: RegistrationRow[]) {
  return {
    all: rows.length,
    empresa: rows.filter((r) => r.role_at_event === "empresa").length,
    sponsor: rows.filter((r) => r.role_at_event === "sponsor").length,
  };
}

/**
 * Deja solo los participantes del tipo elegido y los ordena alfabéticamente
 * por empresa o por nombre, ascendente o descendente.
 */
export function filterAndSortRegistrations<T extends RegistrationRow>(
  rows: T[],
  opts: { role: RoleFilter; field: SortField; dir: SortDir },
): T[] {
  const base = opts.role === "all" ? rows : rows.filter((r) => r.role_at_event === opts.role);
  return sortByName(base, (r) => (opts.field === "company" ? r.attendee_company : r.attendee_name) ?? "", opts.dir);
}

export type AccountGroup<T> = { key: string; company: string; role: string; people: T[] };

/**
 * Agrupa las personas inscritas por empresa/solución (misma empresa y mismo tipo),
 * ignorando las canceladas, y ordena los grupos y sus personas alfabéticamente.
 */
export function groupRegistrationsByAccount<T extends RegistrationRow & { status?: string | null }>(
  rows: T[],
  dir: SortDir = "asc",
): AccountGroup<T>[] {
  const map = new Map<string, AccountGroup<T>>();
  for (const r of rows) {
    if (r.status === "cancelled") continue;
    const company = (r.attendee_company ?? "").trim() || "(sin empresa)";
    const role = r.role_at_event ?? "";
    const key = `${role}::${company.toLowerCase()}`;
    const g = map.get(key) ?? { key, company, role, people: [] };
    g.people.push(r);
    map.set(key, g);
  }
  const groups = sortByName(Array.from(map.values()), (g) => g.company, dir);
  for (const g of groups) g.people = sortByName(g.people, (p) => p.attendee_name ?? "", "asc");
  return groups;
}

/** Número de empresas y soluciones únicas (no de personas). */
export function accountCounts(rows: (RegistrationRow & { status?: string | null })[]) {
  const groups = groupRegistrationsByAccount(rows);
  return {
    empresa: groups.filter((g) => g.role === "empresa").length,
    sponsor: groups.filter((g) => g.role === "sponsor").length,
    people: groups.reduce((n, g) => n + g.people.length, 0),
  };
}
