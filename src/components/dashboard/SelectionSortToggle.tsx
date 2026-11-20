import { ArrowDownAZ, ArrowUpAZ, ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { SELECTION_SORT_OPTIONS, type SelectionSortKey } from "@/lib/selection-sort";

const ICONS = {
  name_asc: ArrowDownAZ,
  name_desc: ArrowUpAZ,
  total_desc: ArrowDownWideNarrow,
  total_asc: ArrowUpNarrowWide,
} as const;

/**
 * Selector de orden de la vista de selecciones: alfabético o por total de selecciones.
 */
export function SelectionSortToggle({ value, onChange }: { value: SelectionSortKey; onChange: (v: SelectionSortKey) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden" title="Orden de la lista">
      {SELECTION_SORT_OPTIONS.map((opt, i) => {
        const Icon = ICONS[opt.key];
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-uppercase-wide ${
              i > 0 ? "border-l border-border" : ""
            } ${active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <Icon className="h-3.5 w-3.5" /> {opt.label}
          </button>
        );
      })}
    </div>
  );
}
