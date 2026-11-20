import { sortByName, type SortDir } from "@/components/dashboard/SortToggle";

/**
 * Modos de orden de la lista de selecciones del panel de administración:
 * alfabético (A→Z / Z→A) o por total de selecciones (de más a menos / de menos a más).
 */
export type SelectionSortKey = "name_asc" | "name_desc" | "total_desc" | "total_asc";

export type SelectionSortable = {
  company_name?: string | null;
  total?: number | null;
};

/** Opciones visibles del selector de orden, en el orden en que se muestran. */
export const SELECTION_SORT_OPTIONS: { key: SelectionSortKey; label: string }[] = [
  { key: "name_asc", label: "A→Z" },
  { key: "name_desc", label: "Z→A" },
  { key: "total_desc", label: "Más selecciones" },
  { key: "total_asc", label: "Menos selecciones" },
];

/**
 * Ordena las cuentas de la vista de selecciones.
 * Por total, las empatadas quedan en orden alfabético ascendente.
 */
export function sortSelectionAccounts<T extends SelectionSortable>(accounts: T[], key: SelectionSortKey): T[] {
  const list = [...accounts];
  if (key === "name_asc" || key === "name_desc") {
    return sortByName(list, (a) => a.company_name, key === "name_asc" ? "asc" : "desc");
  }
  const byName = (a: T, b: T) => (a.company_name ?? "").localeCompare(b.company_name ?? "", "es", { sensitivity: "base" });
  const byTotal = (a: T, b: T) => (a.total ?? 0) - (b.total ?? 0);
  return list.sort((a, b) => (key === "total_desc" ? byTotal(b, a) : byTotal(a, b)) || byName(a, b));
}

/**
 * Dirección alfabética que deben seguir las cuentas seleccionadas de cada ficha:
 * Z→A solo cuando la lista está ordenada alfabéticamente descendente.
 */
export function targetSortDir(key: SelectionSortKey): SortDir {
  return key === "name_desc" ? "desc" : "asc";
}
