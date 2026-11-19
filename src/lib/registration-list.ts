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
